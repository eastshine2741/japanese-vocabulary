import { describe, expect, it } from 'vitest';
import { pillDockAfterDrag, shouldStartDockPan } from './pillDockGesture';

describe('shouldStartDockPan', () => {
  it('starts on a vertical drag past the slop', () => {
    expect(shouldStartDockPan({ dx: 2, dy: 12 })).toBe(true);
    expect(shouldStartDockPan({ dx: 2, dy: -12 })).toBe(true);
  });

  it('ignores taps and horizontal movement', () => {
    expect(shouldStartDockPan({ dx: 0, dy: 4 })).toBe(false);
    expect(shouldStartDockPan({ dx: 30, dy: 12 })).toBe(false);
  });
});

describe('pillDockAfterDrag', () => {
  it('switches after a short drag toward the other dock', () => {
    expect(pillDockAfterDrag('bottom', { dy: -30, vy: 0 }, 600)).toBe('bottom');
    expect(pillDockAfterDrag('bottom', { dy: -48, vy: 0 }, 600)).toBe('top');
    expect(pillDockAfterDrag('top', { dy: 30, vy: 0 }, 600)).toBe('top');
    expect(pillDockAfterDrag('top', { dy: 48, vy: 0 }, 600)).toBe('bottom');
  });

  it('switches on a light flick even when the drag was short', () => {
    expect(pillDockAfterDrag('bottom', { dy: -12, vy: -0.4 }, 600)).toBe('top');
    expect(pillDockAfterDrag('top', { dy: 12, vy: 0.4 }, 600)).toBe('bottom');
    expect(pillDockAfterDrag('bottom', { dy: -12, vy: -0.1 }, 600)).toBe('bottom');
  });

  it('stays when flicked back toward the current dock after a long drag', () => {
    expect(pillDockAfterDrag('bottom', { dy: -200, vy: 0.5 }, 600)).toBe('bottom');
    expect(pillDockAfterDrag('top', { dy: 200, vy: -0.5 }, 600)).toBe('top');
  });

  it('ignores drags in the wrong direction', () => {
    expect(pillDockAfterDrag('bottom', { dy: 400, vy: 0 }, 600)).toBe('bottom');
    expect(pillDockAfterDrag('top', { dy: -400, vy: 0 }, 600)).toBe('top');
  });

  it('shrinks the distance threshold when there is little room to travel', () => {
    expect(pillDockAfterDrag('bottom', { dy: -30, vy: 0 }, 40)).toBe('top');
  });

  it('stays put when there is no room to travel', () => {
    expect(pillDockAfterDrag('bottom', { dy: -400, vy: 0 }, 0)).toBe('bottom');
  });
});
