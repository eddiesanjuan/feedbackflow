/**
 * AI Pipeline - Barrel Export
 *
 * Re-exports the pipeline manager and key types for use in the main process.
 */

export { processSession } from './AIPipelineManager';
export type { PipelineProcessOptions } from './AIPipelineManager';
export type {
  AITier,
  AIPipelineOutput,
  AIPipelineOptions,
  AIPipelineProgress,
  AIPipelineStage,
  AIAnalysisResult,
} from './types';
