import { describe, expect, it } from 'vitest';
import { spreadReach } from './spreadLayer';

describe('spreadReach', () => {
  it('박힌 자리에서 가장 먼 모서리까지 닿는다', () => {
    expect(spreadReach(100, 140, { x: 90, y: 130 })).toBeCloseTo(Math.hypot(90, 130));
    expect(spreadReach(100, 140, { x: 50, y: 70 })).toBeCloseTo(Math.hypot(50, 70));
  });
});
