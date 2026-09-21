import { describe, expect, it } from 'vitest';
import type { SongWordTierDto } from '../../types/song';
import { selectCurrentTier } from './songDetailWordDerivation';

function tier(order: number, totalCount: number, knownCount: number): SongWordTierDto {
  return {
    key: (['CORE', 'STARTER', 'BASIC', 'ADVANCED'] as const)[order - 1],
    order,
    name: `s${order}`,
    description: '',
    wordJapanese: [],
    totalCount,
    knownCount,
    learningCount: 0,
  };
}

describe('selectCurrentTier', () => {
  it('picks the first unfinished tier', () => {
    const tiers = [tier(1, 10, 10), tier(2, 17, 10), tier(3, 19, 0), tier(4, 58, 0)];
    expect(selectCurrentTier(tiers)?.order).toBe(2);
  });

  it('returns null when everything is known', () => {
    const tiers = [tier(1, 10, 10), tier(2, 5, 5)];
    expect(selectCurrentTier(tiers)).toBeNull();
  });

  it('skips an empty tier so the next one becomes current', () => {
    const tiers = [tier(1, 0, 0), tier(2, 3, 0)];
    expect(selectCurrentTier(tiers)?.order).toBe(2);
  });
});
