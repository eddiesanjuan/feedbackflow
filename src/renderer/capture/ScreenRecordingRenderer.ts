/**
 * ScreenRecordingRenderer - Renderer-side full session screen recorder.
 *
 * Captures the selected desktop source continuously with MediaRecorder and
 * streams chunks to the main process for durable file writing.
 */

interface StartOptions {
  sessionId: string;
  sourceId: string;
}

interface StopResult {
  success: boolean;
  path?: string;
  bytes?: number;
  mimeType?: string;
  error?: string;
}

interface DesktopVideoConstraints extends MediaTrackConstraints {
  mandatory?: {
    chromeMediaSource: 'desktop';
    chromeMediaSourceId: string;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    maxFrameRate?: number;
  };
}

const MIME_TYPE_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

function chooseMimeType(): string {
  for (const candidate of MIME_TYPE_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return 'video/webm';
}

export class ScreenRecordingRenderer {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private activeSessionId: string | null = null;
  private inFlightWrites: Set<Promise<void>> = new Set();
  private stopping = false;
  private recordingStartTime: number | null = null;

  private getDesktopConstraints(
    sourceId: string,
    highQuality: boolean
  ): MediaStreamConstraints {
    if (highQuality) {
      return {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: 1280,
            minHeight: 720,
            maxWidth: 3840,
            maxHeight: 2160,
            maxFrameRate: 30,
          },
        } as DesktopVideoConstraints,
      };
    }

    return {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
      } as DesktopVideoConstraints,
    };
  }

  private async getCandidateSourceIds(preferredSourceId: string): Promise<string[]> {
    const candidates = new Set<string>([preferredSourceId]);
    const captureApi = window.feedbackflow?.capture;
    if (!captureApi?.getSources) {
      return Array.from(candidates);
    }

    try {
      const sources = await captureApi.getSources();
      for (const source of sources) {
        if (source.type === 'screen') {
          candidates.add(source.id);
        }
      }
    } catch (error) {
      console.warn('[ScreenRecordingRenderer] Failed to enumerate capture sources:', error);
    }

    return Array.from(candidates);
  }

  private async acquireScreenStream(sourceId: string): Promise<MediaStream> {
    let lastError: unknown;
    const candidates = await this.getCandidateSourceIds(sourceId);

    for (const candidateId of candidates) {
      const highQualityConstraints = this.getDesktopConstraints(candidateId, true);
      const fallbackConstraints = this.getDesktopConstraints(candidateId, false);

      try {
        return await navigator.mediaDevices.getUserMedia(highQualityConstraints);
      } catch (primaryError) {
        console.warn(
          `[ScreenRecordingRenderer] High-quality capture failed for ${candidateId}, retrying fallback:`,
          primaryError
        );
        lastError = primaryError;
      }

      try {
        return await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      } catch (fallbackError) {
        console.warn(
          `[ScreenRecordingRenderer] Fallback capture failed for ${candidateId}:`,
          fallbackError
        );
        lastError = fallbackError;
      }
    }

    if (typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      try {
        return await navigator.mediaDevices.getDisplayMedia({
          audio: false,
          video: {
            frameRate: { ideal: 30, max: 30 },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch (displayMediaError) {
        lastError = displayMediaError;
      }
    }

    const message =
      lastError instanceof Error
        ? lastError.message
        : 'Unable to acquire a screen capture stream';
    throw new Error(message);
  }

  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state !== 'inactive';
  }

  isPaused(): boolean {
    return this.mediaRecorder?.state === 'paused';
  }

  getSessionId(): string | null {
    return this.activeSessionId;
  }

  getRecordingStartTime(): number | null {
    return this.recordingStartTime;
  }

  async start(options: StartOptions): Promise<void> {
    if (this.isRecording()) {
      return;
    }

    const mimeType = chooseMimeType();
    const stream = await this.acquireScreenStream(options.sourceId);

    const recordingStartTime = Date.now();
    const startResult = await window.feedbackflow.screenRecording.start(
      options.sessionId,
      mimeType,
      recordingStartTime
    );
    if (!startResult.success) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error(startResult.error || 'Unable to start screen recording persistence.');
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
    } catch (error) {
      // MediaRecorder construction failed — clean up the main-process artifact and stream.
      stream.getTracks().forEach((track) => track.stop());
      await window.feedbackflow.screenRecording.stop(options.sessionId).catch(() => {});
      throw error;
    }

    recorder.ondataavailable = (event: BlobEvent) => {
      if (!event.data || event.data.size === 0 || !this.activeSessionId) {
        return;
      }

      const sessionId = this.activeSessionId;
      const writePromise = event.data
        .arrayBuffer()
        .then((buffer) =>
          window.feedbackflow.screenRecording.appendChunk(sessionId, new Uint8Array(buffer))
        )
        .then((result) => {
          if (!result.success) {
            throw new Error(result.error || 'Failed to append recording chunk.');
          }
        })
        .catch((error) => {
          console.error('[ScreenRecordingRenderer] Chunk write failed:', error);
        })
        .finally(() => {
          this.inFlightWrites.delete(writePromise);
        });

      this.inFlightWrites.add(writePromise);
    };

    this.mediaStream = stream;
    this.mediaRecorder = recorder;
    this.activeSessionId = options.sessionId;
    this.stopping = false;
    this.recordingStartTime = recordingStartTime;

    // Emit chunks every second for near-real-time persistence.
    try {
      recorder.start(1000);
    } catch (error) {
      // recorder.start() failed — clean up everything.
      this.cleanupStream();
      this.mediaRecorder = null;
      this.activeSessionId = null;
      this.recordingStartTime = null;
      await window.feedbackflow.screenRecording.stop(options.sessionId).catch(() => {});
      throw error;
    }
  }

  async stop(): Promise<StopResult> {
    if (!this.mediaRecorder || !this.activeSessionId || this.stopping) {
      return { success: true };
    }

    this.stopping = true;
    const sessionId = this.activeSessionId;
    const recorder = this.mediaRecorder;

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 4000);
      recorder.onstop = () => {
        clearTimeout(timeout);
        resolve();
      };
      try {
        recorder.stop();
      } catch {
        clearTimeout(timeout);
        resolve();
      }
    });

    await Promise.allSettled(Array.from(this.inFlightWrites));
    this.inFlightWrites.clear();

    const result = await window.feedbackflow.screenRecording.stop(sessionId);
    this.cleanupStream();
    this.mediaRecorder = null;
    this.activeSessionId = null;
    this.stopping = false;
    this.recordingStartTime = null;
    return result;
  }

  async pause(): Promise<void> {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
      return;
    }

    try {
      this.mediaRecorder.pause();
    } catch (error) {
      console.warn('[ScreenRecordingRenderer] Failed to pause recording:', error);
    }
  }

  async resume(): Promise<void> {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'paused') {
      return;
    }

    try {
      this.mediaRecorder.resume();
    } catch (error) {
      console.warn('[ScreenRecordingRenderer] Failed to resume recording:', error);
    }
  }

  private cleanupStream(): void {
    if (!this.mediaStream) {
      return;
    }
    this.mediaStream.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
  }
}

let screenRecordingRendererInstance: ScreenRecordingRenderer | null = null;

export function getScreenRecordingRenderer(): ScreenRecordingRenderer {
  if (!screenRecordingRendererInstance) {
    screenRecordingRendererInstance = new ScreenRecordingRenderer();
  }
  return screenRecordingRendererInstance;
}

export default getScreenRecordingRenderer;
