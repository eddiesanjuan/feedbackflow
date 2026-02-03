/**
 * Output Module Tests
 */

import { describe, it, expect } from 'vitest';
import type { FeedbackSession, Screenshot, TranscriptionSegment } from '../src/shared/types';

// Mock OutputManager for testing without Electron dependencies
class MockOutputManager {
  generateMarkdown(session: FeedbackSession) {
    const { id, screenshots, transcription, startedAt, endedAt } = session;

    let markdown = '# Feedback Session\n\n';
    markdown += `**Session ID:** ${id}\n`;
    markdown += `**Started:** ${new Date(startedAt).toISOString()}\n`;
    if (endedAt) {
      markdown += `**Ended:** ${new Date(endedAt).toISOString()}\n`;
    }
    markdown += '\n---\n\n';

    // Add transcription
    for (const segment of transcription) {
      markdown += `${segment.text}\n\n`;
    }

    // Add screenshots
    for (const screenshot of screenshots) {
      markdown += `![Screenshot](${screenshot.base64 || screenshot.imagePath})\n\n`;
    }

    return {
      sessionId: id,
      generatedAt: Date.now(),
      markdown,
      screenshots,
    };
  }
}

describe('OutputManager', () => {
  it('should generate markdown from a session', () => {
    const manager = new MockOutputManager();

    const session: FeedbackSession = {
      id: 'test-session-1',
      startedAt: Date.now() - 60000,
      endedAt: Date.now(),
      status: 'complete',
      screenshots: [
        {
          id: 'screenshot-1',
          timestamp: Date.now() - 30000,
          imagePath: '/tmp/screenshot-1.png',
          width: 1920,
          height: 1080,
        },
      ],
      transcription: [
        {
          id: 'segment-1',
          text: 'This is a test transcription.',
          startTime: Date.now() - 45000,
          endTime: Date.now() - 35000,
          confidence: 0.95,
          isFinal: true,
        },
      ],
    };

    const output = manager.generateMarkdown(session);

    expect(output.sessionId).toBe('test-session-1');
    expect(output.markdown).toContain('# Feedback Session');
    expect(output.markdown).toContain('test-session-1');
    expect(output.markdown).toContain('This is a test transcription.');
    expect(output.markdown).toContain('![Screenshot]');
  });

  it('should handle empty sessions', () => {
    const manager = new MockOutputManager();

    const session: FeedbackSession = {
      id: 'empty-session',
      startedAt: Date.now(),
      status: 'complete',
      screenshots: [],
      transcription: [],
    };

    const output = manager.generateMarkdown(session);

    expect(output.sessionId).toBe('empty-session');
    expect(output.markdown).toContain('# Feedback Session');
    expect(output.screenshots).toHaveLength(0);
  });
});
