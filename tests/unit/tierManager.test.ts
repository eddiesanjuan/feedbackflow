import { describe, expect, it, vi } from 'vitest';
import { TierManager } from '../../src/main/transcription/TierManager';
import type { TierStatus } from '../../src/main/transcription/types';

function makeStatuses(
  overrides: Partial<Record<TierStatus['tier'], TierStatus>>
): TierStatus[] {
  const defaults: TierStatus[] = [
    { tier: 'whisper', available: false, reason: 'Model not downloaded' },
    { tier: 'macos-dictation', available: true },
    { tier: 'timer-only', available: true },
  ];

  return defaults.map((status) => overrides[status.tier] ?? status);
}

describe('TierManager preference selection', () => {
  it('prefers Whisper by default when auto mode and Whisper is available', async () => {
    const manager = new TierManager();
    vi.spyOn(manager, 'getTierStatuses').mockResolvedValue(
      makeStatuses({
        whisper: { tier: 'whisper', available: true },
      })
    );

    const selected = await manager.selectBestTier();
    expect(selected).toBe('whisper');
  });

  it('uses preferred Whisper when available', async () => {
    const manager = new TierManager();
    manager.setPreferredTier('whisper');
    vi.spyOn(manager, 'getTierStatuses').mockResolvedValue(
      makeStatuses({
        whisper: { tier: 'whisper', available: true },
      })
    );

    const selected = await manager.selectBestTier();
    expect(selected).toBe('whisper');
  });

  it('falls back automatically when preferred tier is unavailable', async () => {
    const manager = new TierManager();
    manager.setPreferredTier('whisper');
    vi.spyOn(manager, 'getTierStatuses').mockResolvedValue(
      makeStatuses({
        whisper: { tier: 'whisper', available: false, reason: 'No model' },
        'macos-dictation': { tier: 'macos-dictation', available: true },
      })
    );

    const selected = await manager.selectBestTier();
    expect(selected).toBe('macos-dictation');
  });

  it('rejects non-transcribing preferred tiers in strict feedback mode', () => {
    const manager = new TierManager();
    expect(() => manager.setPreferredTier('timer-only')).toThrow(
      'does not provide transcription'
    );
  });
});
