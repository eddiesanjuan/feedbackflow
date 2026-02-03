/**
 * Shared types for FeedbackFlow
 */

/**
 * Represents a single screenshot captured during a feedback session
 */
export interface Screenshot {
  id: string;
  timestamp: number;
  imagePath: string;
  base64?: string;
  width: number;
  height: number;
}

/**
 * Represents a transcription segment from voice narration
 */
export interface TranscriptionSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  isFinal: boolean;
}

/**
 * Represents a complete feedback session
 */
export interface FeedbackSession {
  id: string;
  startedAt: number;
  endedAt?: number;
  screenshots: Screenshot[];
  transcription: TranscriptionSegment[];
  status: SessionStatus;
}

/**
 * Session status enum
 */
export type SessionStatus = 'idle' | 'recording' | 'processing' | 'complete' | 'error';

/**
 * Application settings
 */
export interface AppSettings {
  deepgramApiKey: string;
  outputFormat: 'markdown' | 'json';
  screenshotQuality: number;
  pauseThresholdMs: number;
  globalHotkey: string;
  autoClipboard: boolean;
  outputDirectory?: string;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: AppSettings = {
  deepgramApiKey: '',
  outputFormat: 'markdown',
  screenshotQuality: 80,
  pauseThresholdMs: 1500,
  globalHotkey: 'CommandOrControl+Shift+F',
  autoClipboard: true,
};

/**
 * IPC channel names for main/renderer communication
 */
export const IPC_CHANNELS = {
  // Session control
  START_SESSION: 'session:start',
  STOP_SESSION: 'session:stop',
  SESSION_STATUS: 'session:status',

  // Transcription events
  TRANSCRIPTION_UPDATE: 'transcription:update',
  TRANSCRIPTION_FINAL: 'transcription:final',

  // Screenshot events
  SCREENSHOT_CAPTURED: 'screenshot:captured',

  // Output events
  OUTPUT_READY: 'output:ready',
  OUTPUT_ERROR: 'output:error',

  // Settings
  GET_SETTINGS: 'settings:get',
  SET_SETTINGS: 'settings:set',

  // Clipboard
  COPY_TO_CLIPBOARD: 'clipboard:copy',
} as const;

/**
 * Output document structure
 */
export interface OutputDocument {
  sessionId: string;
  generatedAt: number;
  markdown: string;
  screenshots: Screenshot[];
}
