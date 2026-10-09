import { describe, expect, it } from 'vitest';
import type { SongContributor } from '../../types/songReport';
import { CONTRIBUTOR_COLORS, contributorColor, contributorInitial } from './songDetailContributors';

function contributor(overrides: Partial<SongContributor>): SongContributor {
  return { userId: 1, username: 'eastshine', name: '유저', profileImageUrl: null, ...overrides };
}

describe('contributorInitial', () => {
  it('이름이 없거나 비면 username 으로 세운다', () => {
    expect(contributorInitial(contributor({}))).toBe('유');
    expect(contributorInitial(contributor({ name: '   ' }))).toBe('E');
    expect(contributorInitial(contributor({ name: null }))).toBe('E');
  });

  it('이모지처럼 두 칸짜리 글자도 통째로 센다', () => {
    expect(contributorInitial(contributor({ name: '🙂지민' }))).toBe('🙂');
  });
});

describe('contributorColor', () => {
  it('자리 순서대로 돌려 쓴다', () => {
    expect(contributorColor(0)).toBe(CONTRIBUTOR_COLORS[0]);
    expect(contributorColor(CONTRIBUTOR_COLORS.length)).toBe(CONTRIBUTOR_COLORS[0]);
  });
});
