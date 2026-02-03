/**
 * Output Module
 *
 * Handles:
 * - Markdown document generation
 * - Screenshot embedding (base64)
 * - Timestamp formatting
 * - Clipboard integration
 */

import type { FeedbackSession, OutputDocument, Screenshot, TranscriptionSegment } from '../../shared/types';

export class OutputManager {
  /**
   * Generate a Markdown document from a feedback session
   */
  generateMarkdown(session: FeedbackSession): OutputDocument {
    const { id, screenshots, transcription, startedAt, endedAt } = session;

    // Build markdown content
    let markdown = '# Feedback Session\n\n';

    // Session metadata
    markdown += `**Session ID:** ${id}\n`;
    markdown += `**Started:** ${new Date(startedAt).toISOString()}\n`;
    if (endedAt) {
      markdown += `**Ended:** ${new Date(endedAt).toISOString()}\n`;
      markdown += `**Duration:** ${Math.round((endedAt - startedAt) / 1000)}s\n`;
    }
    markdown += '\n---\n\n';

    // Interleave transcription and screenshots by timestamp
    const timeline = this.buildTimeline(transcription, screenshots);

    for (const item of timeline) {
      if (item.type === 'text') {
        markdown += `${item.content}\n\n`;
      } else if (item.type === 'screenshot') {
        markdown += `![Screenshot at ${this.formatTimestamp(item.timestamp)}](${item.content})\n\n`;
      }
    }

    return {
      sessionId: id,
      generatedAt: Date.now(),
      markdown,
      screenshots,
    };
  }

  /**
   * Build a timeline interleaving transcription and screenshots
   */
  private buildTimeline(
    transcription: TranscriptionSegment[],
    screenshots: Screenshot[]
  ): Array<{ type: 'text' | 'screenshot'; content: string; timestamp: number }> {
    const timeline: Array<{ type: 'text' | 'screenshot'; content: string; timestamp: number }> = [];

    // Add transcription segments
    for (const segment of transcription) {
      timeline.push({
        type: 'text',
        content: segment.text,
        timestamp: segment.startTime,
      });
    }

    // Add screenshots
    for (const screenshot of screenshots) {
      timeline.push({
        type: 'screenshot',
        content: screenshot.base64 || screenshot.imagePath,
        timestamp: screenshot.timestamp,
      });
    }

    // Sort by timestamp
    timeline.sort((a, b) => a.timestamp - b.timestamp);

    return timeline;
  }

  /**
   * Format a timestamp as a readable string
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}

export default OutputManager;
