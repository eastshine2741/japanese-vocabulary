import { describe, expect, it } from 'vitest';
import { DEFAULT_SECONDS_PER_CARD, estimateSecondsPerCard, remainingTimeLabel } from './sessionEta';

describe('estimateSecondsPerCard', () => {
  it('몇 장 재기 전엔 기본값을 쓴다', () => {
    expect(estimateSecondsPerCard([])).toBe(DEFAULT_SECONDS_PER_CARD);
    expect(estimateSecondsPerCard([2, 2])).toBe(DEFAULT_SECONDS_PER_CARD);
  });

  it('중앙값이라 오래 멈춘 한 장에 끌려가지 않는다', () => {
    expect(estimateSecondsPerCard([2, 3, 90])).toBe(3);
    expect(estimateSecondsPerCard([4, 2, 6, 8])).toBe(5);
  });
});

describe('remainingTimeLabel', () => {
  it('남은 카드가 없으면 그리지 않는다', () => {
    expect(remainingTimeLabel(0, 5)).toBeNull();
    expect(remainingTimeLabel(-1, 5)).toBeNull();
  });

  it('분으로 반올림하고 1분 아래는 1분으로 보여준다', () => {
    expect(remainingTimeLabel(40, 5)).toBe('3분');
    expect(remainingTimeLabel(3, 5)).toBe('1분');
    expect(remainingTimeLabel(120, 10)).toBe('20분');
  });
});
