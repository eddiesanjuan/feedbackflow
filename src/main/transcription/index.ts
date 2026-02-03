/**
 * Transcription Module
 *
 * Handles:
 * - Real-time transcription via Deepgram WebSocket API
 * - Interim and final transcript handling
 * - Transcript segment management
 */

import type { TranscriptionSegment } from '../../shared/types';

export interface TranscriptionEvents {
  onInterim: (text: string) => void;
  onFinal: (segment: TranscriptionSegment) => void;
  onError: (error: Error) => void;
}

export class TranscriptionManager {
  private apiKey: string;
  private segments: TranscriptionSegment[] = [];
  private isConnected = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Connect to Deepgram and start transcription
   */
  async connect(events: TranscriptionEvents): Promise<void> {
    if (!this.apiKey) {
      events.onError(new Error('Deepgram API key not configured'));
      return;
    }

    // TODO: Implement Deepgram WebSocket connection
    // Using @deepgram/sdk for real-time transcription
    //
    // const deepgram = createClient(this.apiKey);
    // const connection = deepgram.listen.live({
    //   model: 'nova-2',
    //   smart_format: true,
    //   interim_results: true,
    //   punctuate: true,
    // });
    //
    // connection.on('Results', (data) => {
    //   const transcript = data.channel.alternatives[0].transcript;
    //   if (data.is_final) {
    //     events.onFinal(...)
    //   } else {
    //     events.onInterim(transcript)
    //   }
    // });

    this.isConnected = true;
    console.log('[TranscriptionManager] Connected to Deepgram');
  }

  /**
   * Send audio data to Deepgram
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (!this.isConnected) {
      return;
    }

    // TODO: Send audio data via WebSocket
    // connection.send(audioData);
  }

  /**
   * Disconnect from Deepgram
   */
  disconnect(): void {
    if (!this.isConnected) {
      return;
    }

    // TODO: Close WebSocket connection
    this.isConnected = false;
    console.log('[TranscriptionManager] Disconnected from Deepgram');
  }

  /**
   * Get all transcription segments
   */
  getSegments(): TranscriptionSegment[] {
    return [...this.segments];
  }

  /**
   * Get full transcript as a single string
   */
  getFullTranscript(): string {
    return this.segments.map((s) => s.text).join(' ');
  }

  /**
   * Clear all segments
   */
  clear(): void {
    this.segments = [];
  }
}

export default TranscriptionManager;
