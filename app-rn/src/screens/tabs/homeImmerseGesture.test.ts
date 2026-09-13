import { describe, expect, it } from 'vitest';
import { immerseProgress, shouldStartImmersePan } from './homeImmerseGesture';

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
