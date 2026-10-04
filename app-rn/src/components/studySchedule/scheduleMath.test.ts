import { describe, expect, it } from 'vitest';
import { estimateMinutes, selectionLine, yAxisTicks } from './scheduleMath';

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

describe('selectionLine', () => {
  it('복습할 단어만 있으면 외운 단어 중에서 고른 수', () => {
    expect(selectionLine(17, 0, 664)).toBe('외운 단어 664장 중 잊어버리기 직전인 17장만 골랐어요');
  });

  it('새 단어가 섞이면 나눠서 센다', () => {
    expect(selectionLine(20, 5, 664)).toBe('잊어버리기 직전인 단어 15장과 새 단어 5장이에요');
  });

  it('새 단어만 있으면 새 단어 수', () => {
    expect(selectionLine(460, 460, 0)).toBe('처음 배우는 새 단어 460장이에요');
  });

  it('오늘 볼 카드가 없으면 문구 없음', () => {
    expect(selectionLine(0, 0, 664)).toBeNull();
  });
});

describe('yAxisTicks', () => {
  it('보기 좋은 간격으로 max 이하까지', () => {
    expect(yAxisTicks(664)).toEqual([0, 200, 400, 600]);
    expect(yAxisTicks(1030)).toEqual([0, 250, 500, 750, 1000]);
    expect(yAxisTicks(87)).toEqual([0, 20, 40, 60, 80]);
  });

  it('작은 수는 1 간격 정수', () => {
    expect(yAxisTicks(2)).toEqual([0, 1, 2]);
  });

  it('0 이하면 0 하나', () => {
    expect(yAxisTicks(0)).toEqual([0]);
  });
});
