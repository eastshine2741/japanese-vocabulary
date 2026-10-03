import { describe, expect, it } from 'vitest';
import type { SongWordTierDto, SongWordTierKey } from '../../types/song';
import {
  buildTierSegments,
  estimateStudyMinutes,
  getTierStatus,
  selectCurrentTier,
  selectExpandedTierKey,
} from './songDetailTier';

const KEYS: SongWordTierKey[] = ['CHORUS', 'SINGALONG', 'FULL'];

function tier(
  order: number,
  totalCount: number,
  longTermCount: number,
  shortTermCount = 0,
): SongWordTierDto {
  return {
    key: KEYS[order - 1],
    order,
    name: `t${order}`,
    description: '',
    wordJapanese: [],
    totalCount,
    knownCount: 0,
    learningCount: 0,
    longTermCount,
    shortTermCount,
    dueCount: 0,
    duePreviewWords: [],
  };
}

describe('selectCurrentTier', () => {
  it('picks the first tier that still has a never-reviewed word', () => {
    const tiers = [tier(1, 10, 4, 6), tier(2, 17, 10), tier(3, 19, 0)];
    expect(selectCurrentTier(tiers)?.order).toBe(2);
  });

  it('treats short-term words as done — only remaining words keep a tier open', () => {
    const tiers = [tier(1, 10, 0, 10), tier(2, 5, 5)];
    expect(selectCurrentTier(tiers)).toBeNull();
  });

  it('skips an empty tier so the next one becomes current', () => {
    const tiers = [tier(1, 0, 0), tier(2, 3, 0)];
    expect(selectCurrentTier(tiers)?.order).toBe(2);
  });
});

describe('selectExpandedTierKey', () => {
  it('expands the current tier', () => {
    const tiers = [tier(1, 12, 12), tier(2, 45, 30), tier(3, 130, 30)];
    expect(selectExpandedTierKey(tiers)).toBe('SINGALONG');
  });

  it('expands the last tier when every tier is done', () => {
    const tiers = [tier(1, 12, 12), tier(2, 45, 40, 5), tier(3, 130, 130)];
    expect(selectExpandedTierKey(tiers)).toBe('FULL');
  });

  it('expands the first tier when nothing is studied yet', () => {
    const tiers = [tier(1, 12, 0), tier(2, 45, 0), tier(3, 130, 0)];
    expect(selectExpandedTierKey(tiers)).toBe('CHORUS');
  });

  it('returns null without tiers', () => {
    expect(selectExpandedTierKey([])).toBeNull();
  });
});

describe('getTierStatus', () => {
  it('marks finished tiers done and the first unfinished one current', () => {
    const tiers = [tier(1, 12, 12), tier(2, 45, 30), tier(3, 130, 30)];
    expect(getTierStatus(tiers, 0)).toBe('done');
    expect(getTierStatus(tiers, 1)).toBe('current');
    expect(getTierStatus(tiers, 2)).toBe('todo');
  });
});

describe('estimateStudyMinutes', () => {
  it('rounds 8 due words up to 3 minutes', () => {
    expect(estimateStudyMinutes(8)).toBe(3);
  });

  it('never goes below a minute while there is something to study', () => {
    expect(estimateStudyMinutes(1)).toBe(1);
  });

  it('is zero when nothing is due', () => {
    expect(estimateStudyMinutes(0)).toBe(0);
  });
});

describe('buildTierSegments', () => {
  it('splits the track into long-term, short-term and remaining', () => {
    const segments = buildTierSegments(tier(1, 10, 4, 2));
    expect(segments.longTermRatio).toBeCloseTo(0.4);
    expect(segments.shortTermRatio).toBeCloseTo(0.2);
    expect(segments.remainingCount).toBe(4);
  });

  it('clamps counts that overflow the total', () => {
    const segments = buildTierSegments(tier(1, 10, 8, 8));
    expect(segments.longTermRatio).toBeCloseTo(0.8);
    expect(segments.shortTermRatio).toBeCloseTo(0.2);
    expect(segments.remainingCount).toBe(0);
  });

  it('keeps an empty tier at zero', () => {
    const segments = buildTierSegments(tier(1, 0, 0));
    expect(segments.longTermRatio).toBe(0);
    expect(segments.shortTermRatio).toBe(0);
    expect(segments.remainingCount).toBe(0);
  });
});
