/**
 * Audio Capture Module
 *
 * Handles:
 * - Microphone access and audio stream capture
 * - Voice activity detection (VAD)
 * - Pause detection for screenshot timing
 */

export interface AudioCaptureOptions {
  sampleRate?: number;
  channels?: number;
  pauseThresholdMs?: number;
}

export interface AudioCaptureEvents {
  onAudioData: (data: Float32Array) => void;
  onVoicePause: () => void;
  onVoiceResume: () => void;
  onError: (error: Error) => void;
}

export class AudioManager {
  private isCapturing = false;
  private pauseThresholdMs: number;
  private lastVoiceActivityTime: number = 0;
  private pauseTimer: NodeJS.Timeout | null = null;

  constructor(options: AudioCaptureOptions = {}) {
    this.pauseThresholdMs = options.pauseThresholdMs ?? 1500;
  }

  /**
   * Start capturing audio from the microphone
   */
  async startCapture(events: AudioCaptureEvents): Promise<void> {
    if (this.isCapturing) {
      return;
    }

    // TODO: Implement actual audio capture using native modules
    // For MVP, we'll use the browser's MediaRecorder API via renderer
    // and stream to Deepgram from there

    this.isCapturing = true;
    console.log('[AudioManager] Audio capture started');
  }

  /**
   * Stop capturing audio
   */
  stopCapture(): void {
    if (!this.isCapturing) {
      return;
    }

    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }

    this.isCapturing = false;
    console.log('[AudioManager] Audio capture stopped');
  }

  /**
   * Check if currently capturing
   */
  isActive(): boolean {
    return this.isCapturing;
  }

  /**
   * Process audio data and detect voice activity
   * Called by the audio processing pipeline
   */
  processAudioData(data: Float32Array): boolean {
    // Simple voice activity detection based on amplitude
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += Math.abs(data[i]);
    }
    const average = sum / data.length;

    // Threshold for voice detection (tune as needed)
    const VOICE_THRESHOLD = 0.01;

    return average > VOICE_THRESHOLD;
  }
}

export default AudioManager;
