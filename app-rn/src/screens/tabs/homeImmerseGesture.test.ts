import { describe, expect, it } from 'vitest';
import {
  immerseProgress,
  pullRefreshDistance,
  pullRefreshThreshold,
  shouldStartImmersePan,
  shouldStartPullRefresh,
} from './homeImmerseGesture';

describe('shouldStartImmersePan', () => {
  it('starts only in the direction that changes the current state', () => {
    expect(shouldStartImmersePan(false, { dx: 2, dy: -18 })).toBe(true);
    expect(shouldStartImmersePan(false, { dx: 2, dy: 18 })).toBe(false);
    expect(shouldStartImmersePan(true, { dx: 2, dy: 18 })).toBe(true);
    expect(shouldStartImmersePan(true, { dx: 2, dy: -18 })).toBe(false);
  });

  it('ignores horizontal and sub-slop movement', () => {
    expect(shouldStartImmersePan(false, { dx: 40, dy: -16 })).toBe(false);
    expect(shouldStartImmersePan(true, { dx: 40, dy: 16 })).toBe(false);
    expect(shouldStartImmersePan(false, { dx: 0, dy: -8 })).toBe(false);
    expect(shouldStartImmersePan(true, { dx: 0, dy: 8 })).toBe(false);
  });
});

describe('immerseProgress', () => {
  it('drags from the current state toward the other one', () => {
    expect(immerseProgress(false, -60)).toBe(0.5);
    expect(immerseProgress(false, -120)).toBe(1);
    expect(immerseProgress(true, 60)).toBe(0.5);
    expect(immerseProgress(true, 120)).toBe(0);
  });

  it('clamps overshoot and the wrong direction', () => {
    expect(immerseProgress(false, -300)).toBe(1);
    expect(immerseProgress(false, 40)).toBe(0);
    expect(immerseProgress(true, 300)).toBe(0);
    expect(immerseProgress(true, -40)).toBe(1);
  });
});

describe('shouldStartPullRefresh', () => {
  it('starts only on a downward drag outside immersion', () => {
    expect(shouldStartPullRefresh(false, { dx: 2, dy: 18 })).toBe(true);
    expect(shouldStartPullRefresh(false, { dx: 2, dy: -18 })).toBe(false);
    expect(shouldStartPullRefresh(true, { dx: 2, dy: 18 })).toBe(false);
  });

  it('ignores horizontal and sub-slop movement', () => {
    expect(shouldStartPullRefresh(false, { dx: 40, dy: 16 })).toBe(false);
    expect(shouldStartPullRefresh(false, { dx: 0, dy: 8 })).toBe(false);
  });
});

describe('pullRefreshDistance', () => {
  it('resists the finger and never goes negative', () => {
    expect(pullRefreshDistance(-40, 0)).toBe(0);
    expect(pullRefreshDistance(100, 0)).toBeLessThan(100);
    expect(pullRefreshDistance(1000, 0)).toBeLessThan(pullRefreshThreshold(0) * 1.5);
  });

  it('needs a longer pull under a taller status bar', () => {
    for (const inset of [0, 24, 59]) {
      const threshold = pullRefreshThreshold(inset);
      expect(pullRefreshDistance(threshold, inset)).toBeLessThan(threshold);
      expect(pullRefreshDistance(threshold * 1.7, inset)).toBeGreaterThanOrEqual(threshold);
    }
  });
});
