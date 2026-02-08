/**
 * Transcription Module
 *
 * Transcription Fallback System:
 * - Tier 1: Local Whisper (default)
 * - Tier 2: macOS Dictation (fallback)
 * - Tier 3: Timer-only (emergency)
 *
 * The TierManager orchestrates tier selection and failover.
 * App works WITHOUT any API keys using local Whisper.
 */

// ============================================================================
// Primary API - TierManager (use this for transcription)
// ============================================================================

export { TierManager, tierManager } from './TierManager';

// ============================================================================
// Supporting Services
// ============================================================================
// Whisper (Tier 1)
export { WhisperService, whisperService } from './WhisperService';

// Silence Detection (for non-Whisper fallback tiers)
export { SilenceDetector, silenceDetector } from './SilenceDetector';

// Model Management
export { ModelDownloadManager, modelDownloadManager } from './ModelDownloadManager';

// ============================================================================
// Types
// ============================================================================

export type {
  // Tier types
  TranscriptionTier,
  WhisperModel,
  TierStatus,
  TierQuality,
  // Event types
  TranscriptEvent,
  PauseEvent,
  WhisperTranscriptResult,
  WhisperConfig,
  // Model types
  ModelInfo,
  DownloadProgress,
  DownloadResult,
  // Silence detection
  SilenceDetectorConfig,
  // Callbacks
  TranscriptCallback,
  PauseCallback,
  TierChangeCallback,
  ErrorCallback,
  ProgressCallback,
  CompleteCallback,
  SilenceCallback,
} from './types';

// Re-export types from shared for convenience
export type { TranscriptionSegment } from '../../shared/types';
