/**
 * AudioCaptureRenderer.ts - Browser-side Audio Capture for markupr
 *
 * Uses getUserMedia + MediaRecorder to avoid fragile WebAudio graphs in
 * packaged macOS builds. Chunks are streamed to main process for persistence
 * and post-session transcription.
 */

interface CaptureConfig {
  deviceId: string | null;
  sampleRate: number;
  channels: number;
  chunkDurationMs: number;
}

interface AudioDeviceInfo {
  id: string;
  name: string;
  isDefault: boolean;
}

class AudioCaptureRenderer {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recorderMimeType = 'audio/webm';
  private capturing = false;
  private config: CaptureConfig = {
    deviceId: null,
    sampleRate: 16000,
    channels: 1,
    chunkDurationMs: 250,
  };
  private cleanupFunctions: Array<() => void> = [];

  constructor() {
    this.setupIPCListeners();
  }

  private setupIPCListeners(): void {
    const api = window.markupr;
    if (!api?.audio) {
      console.error('[AudioCaptureRenderer] markupr.audio API not available');
      return;
    }

    const cleanupDevices = api.audio.onRequestDevices(async () => {
      try {
        const devices = await this.getDevices();
        api.audio.sendDevices(devices);
      } catch (error) {
        api.audio.sendCaptureError((error as Error).message);
      }
    });
    this.cleanupFunctions.push(cleanupDevices);

    const cleanupStart = api.audio.onStartCapture(async (config) => {
      try {
        this.config = { ...this.config, ...config };
        await this.startCapture();
        api.audio.notifyCaptureStarted();
      } catch (error) {
        api.audio.sendCaptureError((error as Error).message);
      }
    });
    this.cleanupFunctions.push(cleanupStart);

    const cleanupStop = api.audio.onStopCapture(async () => {
      await this.stopCapture();
      api.audio.notifyCaptureStopped();
    });
    this.cleanupFunctions.push(cleanupStop);

    const cleanupDevice = api.audio.onSetDevice(async (deviceId) => {
      this.config.deviceId = deviceId;
      if (this.capturing) {
        await this.stopCapture();
        try {
          await this.startCapture();
          api.audio.notifyCaptureStarted();
        } catch (error) {
          api.audio.sendCaptureError((error as Error).message);
        }
      }
    });
    this.cleanupFunctions.push(cleanupDevice);

    console.log('[AudioCaptureRenderer] IPC listeners initialized');
  }

  destroy(): void {
    void this.stopCapture();
    this.cleanupFunctions.forEach((fn) => fn());
    this.cleanupFunctions = [];
  }

  async getDevices(): Promise<AudioDeviceInfo[]> {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((track) => track.stop());
    } catch {
      console.warn('[AudioCaptureRenderer] Could not get permission to enumerate devices');
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === 'audioinput');

    return audioInputs.map((device, index) => ({
      id: device.deviceId,
      name: device.label || `Microphone ${index + 1}`,
      isDefault: device.deviceId === 'default',
    }));
  }

  async startCapture(): Promise<void> {
    if (this.capturing) {
      console.log('[AudioCaptureRenderer] Already capturing');
      return;
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: this.config.deviceId ? { exact: this.config.deviceId } : undefined,
        sampleRate: { ideal: this.config.sampleRate },
        channelCount: { ideal: 1 },
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
      },
      video: false,
    };

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      throw new Error(`Failed to access microphone: ${(error as Error).message}`);
    }

    this.recorderMimeType = this.resolveRecorderMimeType();

    try {
      const options: MediaRecorderOptions = this.recorderMimeType
        ? { mimeType: this.recorderMimeType, audioBitsPerSecond: 128_000 }
        : { audioBitsPerSecond: 128_000 };
      this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
    } catch (error) {
      await this.stopCapture();
      throw new Error(`Failed to initialize media recorder: ${(error as Error).message}`);
    }

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (!this.capturing || !event.data || event.data.size === 0) {
        return;
      }

      const timestamp = performance.now();
      const duration = this.config.chunkDurationMs;
      const mimeType = event.data.type || this.mediaRecorder?.mimeType || this.recorderMimeType;

      void event.data
        .arrayBuffer()
        .then((buffer) => {
          this.sendEncodedChunkToMain(new Uint8Array(buffer), timestamp, duration, mimeType);
        })
        .catch((error) => {
          const api = window.markupr;
          api?.audio?.sendCaptureError(`Failed to process audio chunk: ${(error as Error).message}`);
        });
    };

    this.mediaRecorder.onerror = (event: Event) => {
      const recorderError = (event as ErrorEvent).error;
      const message = recorderError instanceof Error ? recorderError.message : 'Unknown recorder error';
      const api = window.markupr;
      api?.audio?.sendCaptureError(`Audio recorder error: ${message}`);
    };

    try {
      this.mediaRecorder.start(this.config.chunkDurationMs);
      this.capturing = true;
      console.log(
        `[AudioCaptureRenderer] Capture started with MediaRecorder (${this.mediaRecorder.mimeType || this.recorderMimeType})`
      );
    } catch (error) {
      await this.stopCapture();
      throw new Error(`Failed to start media recorder: ${(error as Error).message}`);
    }
  }

  private resolveRecorderMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      '',
    ];

    for (const candidate of candidates) {
      if (!candidate) {
        return '';
      }
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }

    return '';
  }

  private sendEncodedChunkToMain(
    encodedChunk: Uint8Array,
    timestamp: number,
    duration: number,
    mimeType: string
  ): void {
    if (!this.capturing) {
      return;
    }

    const api = window.markupr;
    if (!api?.audio) {
      console.error('[AudioCaptureRenderer] markupr.audio API not available');
      return;
    }

    api.audio.sendAudioChunk({
      encodedChunk,
      timestamp,
      duration,
      mimeType,
    });
  }

  async stopCapture(): Promise<void> {
    if (!this.capturing && !this.mediaStream && !this.mediaRecorder) {
      return;
    }

    const wasCapturing = this.capturing;
    this.capturing = false;

    if (this.mediaRecorder) {
      const recorder = this.mediaRecorder;
      this.mediaRecorder = null;
      recorder.onerror = null;
      recorder.ondataavailable = null;

      if (recorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 1000);
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
      }
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {
        // Best effort
      }
      this.mediaStream = null;
    }

    if (wasCapturing) {
      console.log('[AudioCaptureRenderer] Capture stopped');
    }
  }

  isCapturing(): boolean {
    return this.capturing;
  }
}

// ============================================================================
// Module Initialization
// ============================================================================

let audioCaptureRenderer: AudioCaptureRenderer | null = null;

export function initAudioCapture(): AudioCaptureRenderer {
  if (!audioCaptureRenderer) {
    audioCaptureRenderer = new AudioCaptureRenderer();
  }
  return audioCaptureRenderer;
}

export function getAudioCapture(): AudioCaptureRenderer | null {
  return audioCaptureRenderer;
}

export function destroyAudioCapture(): void {
  if (audioCaptureRenderer) {
    audioCaptureRenderer.destroy();
    audioCaptureRenderer = null;
  }
}

export { AudioCaptureRenderer };
export default initAudioCapture;
