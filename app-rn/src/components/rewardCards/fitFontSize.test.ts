import { describe, expect, it } from 'vitest';
import { fitFontSize, textEm } from './fitFontSize';

describe('fitFontSize', () => {
  it('넉넉하면 최대 크기를 쓴다', () => {
    expect(fitFontSize(['GOLD'], 200, 12)).toBe(12);
  });

  it('가장 긴 글에 맞춰 줄인다', () => {
    const size = fitFontSize(['GOLD', 'PLATINUM'], 50, 12);
    expect(size).toBeLessThan(12);
    expect(textEm('PLATINUM') * size).toBeLessThanOrEqual(50);
  });

  it('한글은 한 자를 1em 으로 센다', () => {
    expect(textEm('기본')).toBe(2);
  });

  it('폭을 아직 모르면 최대 크기', () => {
    expect(fitFontSize(['PLATINUM'], 0, 12)).toBe(12);
  });
});
