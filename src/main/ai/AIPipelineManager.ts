/**
 * AIPipelineManager - Orchestrator for the AI analysis pipeline
 *
 * Determines which processing tier to use (free vs BYOK), generates output accordingly,
 * and ensures the free-tier safety net is always available as fallback.
 *
 * Key invariant: session data is NEVER lost. Free-tier output is always generated first,
 * and AI enhancement is layered on top only when it succeeds.
 */

import type { Session } from '../SessionController';
import type { MarkdownDocument } from '../output/FileManager';
import type { ISettingsManager } from '../settings/SettingsManager';
import { generateDocumentForFileManager } from '../output/sessionAdapter';
import { ClaudeAnalyzer } from './ClaudeAnalyzer';
import { structuredMarkdownBuilder } from './StructuredMarkdownBuilder';
import type {
  AITier,
  AIPipelineOutput,
} from './types';

export interface PipelineProcessOptions {
  settingsManager: ISettingsManager;
  projectName?: string;
  screenshotDir?: string;
  hasRecording?: boolean;
  recordingFilename?: string;
}

/**
 * Determine which AI tier is available based on stored API keys.
 */
async function determineTier(settingsManager: ISettingsManager): Promise<AITier> {
  const anthropicKey = await settingsManager.getApiKey('anthropic');
  if (anthropicKey && anthropicKey.length > 0) {
    return 'byok';
  }
  return 'free';
}

/**
 * Generate a free-tier (rule-based) document. This is the safety net that always works.
 */
function generateFreeTierDocument(
  session: Session,
  projectName: string,
  screenshotDir: string,
): MarkdownDocument {
  return generateDocumentForFileManager(session, {
    projectName,
    screenshotDir,
  });
}

/**
 * Process a session through the AI pipeline.
 *
 * 1. Always generates free-tier output first (safety net)
 * 2. If BYOK tier is available, attempts AI enhancement
 * 3. On any AI failure, returns the free-tier output
 *
 * @returns A MarkdownDocument compatible with FileManager.saveSession()
 */
export async function processSession(
  session: Session,
  options: PipelineProcessOptions,
): Promise<{ document: MarkdownDocument; pipelineOutput: AIPipelineOutput }> {
  const startTime = Date.now();
  const projectName = options.projectName || session.metadata?.sourceName || 'Feedback Session';
  const screenshotDir = options.screenshotDir || './screenshots';

  // ALWAYS generate free-tier output first as safety net
  const freeTierDoc = generateFreeTierDocument(session, projectName, screenshotDir);

  // Determine tier
  const tier = await determineTier(options.settingsManager);

  if (tier === 'free') {
    return {
      document: freeTierDoc,
      pipelineOutput: {
        markdown: freeTierDoc.content,
        aiEnhanced: false,
        processingTimeMs: Date.now() - startTime,
        tier: 'free',
      },
    };
  }

  // BYOK tier: attempt AI enhancement
  try {
    const apiKey = await options.settingsManager.getApiKey('anthropic');
    if (!apiKey) {
      // Shouldn't happen since determineTier checked, but be defensive
      console.warn('[AIPipelineManager] BYOK tier selected but no API key found, falling back to free tier');
      return {
        document: freeTierDoc,
        pipelineOutput: {
          markdown: freeTierDoc.content,
          aiEnhanced: false,
          processingTimeMs: Date.now() - startTime,
          tier: 'free',
          fallbackReason: 'API key not found after tier selection',
        },
      };
    }

    console.log('[AIPipelineManager] Running AI analysis with BYOK tier...');

    const analyzer = new ClaudeAnalyzer(apiKey);
    const analysis = await analyzer.analyze(session);

    if (!analysis) {
      console.warn('[AIPipelineManager] Claude analysis returned null, falling back to free tier');
      return {
        document: freeTierDoc,
        pipelineOutput: {
          markdown: freeTierDoc.content,
          aiEnhanced: false,
          processingTimeMs: Date.now() - startTime,
          tier: 'byok',
          fallbackReason: 'Claude analysis returned null',
        },
      };
    }

    // Build AI-enhanced markdown
    const aiMarkdown = structuredMarkdownBuilder.buildDocument(session, analysis, {
      projectName,
      screenshotDir,
      hasRecording: options.hasRecording,
      recordingFilename: options.recordingFilename,
      modelId: 'claude-sonnet-4-5-20250929',
    });

    // Build a MarkdownDocument compatible with FileManager
    const aiDocument: MarkdownDocument = {
      content: aiMarkdown,
      metadata: {
        itemCount: analysis.items.length,
        screenshotCount: session.screenshotBuffer.length,
        types: [...new Set(analysis.items.map((item) => item.category))],
      },
    };

    console.log(
      `[AIPipelineManager] AI analysis complete: ${analysis.items.length} items, ` +
      `${analysis.metadata.criticalCount} critical, ${analysis.metadata.highCount} high ` +
      `(${Date.now() - startTime}ms)`,
    );

    return {
      document: aiDocument,
      pipelineOutput: {
        markdown: aiMarkdown,
        aiEnhanced: true,
        analysis,
        processingTimeMs: Date.now() - startTime,
        tier: 'byok',
      },
    };
  } catch (error) {
    // ANY error in the AI path falls back to free tier - never lose the session
    console.error(
      '[AIPipelineManager] AI pipeline failed, falling back to free tier:',
      error instanceof Error ? error.message : error,
    );

    return {
      document: freeTierDoc,
      pipelineOutput: {
        markdown: freeTierDoc.content,
        aiEnhanced: false,
        processingTimeMs: Date.now() - startTime,
        tier: 'byok',
        fallbackReason: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
