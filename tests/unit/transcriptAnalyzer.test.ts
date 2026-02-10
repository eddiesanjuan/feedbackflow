import { describe, expect, it } from 'vitest';
import { TranscriptAnalyzer, type KeyMoment } from '../../src/main/pipeline/TranscriptAnalyzer';
import type { TranscriptSegment } from '../../src/main/pipeline/PostProcessor';

function makeSegments(): TranscriptSegment[] {
  return [
    { text: 'Start feedback', startTime: 0, endTime: 2, confidence: 0.9 },
    { text: 'More context', startTime: 4, endTime: 7, confidence: 0.9 },
  ];
}

describe('TranscriptAnalyzer', () => {
  it('adds periodic captures only when no AI hints are present', () => {
    const analyzer = new TranscriptAnalyzer();
    const segments: TranscriptSegment[] = [
      { text: 'session start', startTime: 0, endTime: 10, confidence: 0.9 },
      { text: 'session end', startTime: 11, endTime: 30, confidence: 0.9 },
    ];

    const withoutHints = analyzer.analyze(segments, []);
    const withHints = analyzer.analyze(segments, [
      { timestamp: 30, reason: 'AI-highlighted context', confidence: 0.9 },
    ]);

    expect(withoutHints.some((moment) => moment.reason === 'Periodic capture')).toBe(true);
    expect(withHints.some((moment) => moment.reason === 'Periodic capture')).toBe(false);
  });

  it('keeps AI hint when it overlaps a periodic candidate', () => {
    const analyzer = new TranscriptAnalyzer();
    const moments = analyzer.analyze(makeSegments(), [
      { timestamp: 2.05, reason: 'AI-timestamped issue context', confidence: 0.92 },
    ]);

    const overlapping = moments.find((moment) => Math.abs(moment.timestamp - 2.05) < 0.2);
    expect(overlapping).toBeDefined();
    expect(overlapping?.reason).toMatch(/AI/i);
  });

  it('prioritizes AI hints when capping a large set', () => {
    const analyzer = new TranscriptAnalyzer();
    const segments: TranscriptSegment[] = Array.from({ length: 30 }, (_, index) => {
      const start = index * 3;
      return {
        text: `segment ${index + 1}`,
        startTime: start,
        endTime: start + 1.8,
        confidence: 0.8,
      };
    });

    const aiHints: KeyMoment[] = [
      { timestamp: 12, reason: 'AI-highlighted context', confidence: 0.9 },
      { timestamp: 33, reason: 'AI-highlighted context', confidence: 0.9 },
      { timestamp: 54, reason: 'AI-highlighted context', confidence: 0.9 },
    ];

    const result = analyzer.analyze(segments, aiHints);
    const aiCount = result.filter((moment) => /AI/i.test(moment.reason)).length;

    expect(result.length).toBeLessThanOrEqual(20);
    expect(aiCount).toBeGreaterThanOrEqual(2);
  });
});
