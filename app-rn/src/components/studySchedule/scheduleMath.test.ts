import { describe, expect, it } from 'vitest';
import { estimateMinutes } from './scheduleMath';

describe('estimateMinutes', () => {
  it('0장은 0분', () => {
    expect(estimateMinutes(0)).toBe(0);
    expect(estimateMinutes(-3)).toBe(0);
  });

  it('1장이라도 있으면 최소 1분', () => {
    expect(estimateMinutes(1)).toBe(1);
  });

  it('25초/장을 분으로 반올림한다', () => {
    expect(estimateMinutes(17)).toBe(7);
    expect(estimateMinutes(40)).toBe(17);
  });
});
