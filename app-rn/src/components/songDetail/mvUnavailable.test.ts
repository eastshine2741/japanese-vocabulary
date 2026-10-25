import { describe, expect, it } from 'vitest';
import { canWatchOnYoutube, mvBlock, mvBlockLabel } from './mvUnavailable';

describe('mvBlock', () => {
  it('prefers the reason the server knows over a bare player error', () => {
    expect(mvBlock('AGE_RESTRICTED', true)).toBe('AGE_RESTRICTED');
  });

  it('falls back to a generic block when only the player failed', () => {
    expect(mvBlock(null, true)).toBe('PLAYER_ERROR');
  });

  it('does not block a playable MV', () => {
    expect(mvBlock(undefined, false)).toBeNull();
  });
});

describe('mvBlockLabel', () => {
  it('names each reason', () => {
    expect(mvBlockLabel('AGE_RESTRICTED')).toBe('연령 제한 영상');
    expect(mvBlockLabel('UNAVAILABLE')).toBe('삭제됐거나 볼 수 없는 영상이에요');
    expect(mvBlockLabel('PLAYER_ERROR')).toBe('재생할 수 없는 영상이에요');
  });
});

describe('canWatchOnYoutube', () => {
  it('offers YouTube only for age-restricted MVs', () => {
    expect(canWatchOnYoutube('AGE_RESTRICTED')).toBe(true);
    expect(canWatchOnYoutube('UNAVAILABLE')).toBe(false);
    expect(canWatchOnYoutube('PLAYER_ERROR')).toBe(false);
  });
});
