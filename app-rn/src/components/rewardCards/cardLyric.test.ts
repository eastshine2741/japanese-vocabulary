import { describe, expect, it } from 'vitest';
import { lyricFitScale, lyricRowFitScale, textFitScale, lyricText, pickLines, samePick, toggleLine } from './cardLyric';
import { CardLyricLine } from './types';

const line = (index: number, ko = `${index}`): CardLyricLine => ({
  index,
  ruby: [{ text: '夜', reading: 'よる' }, { text: `の${index}` }],
  ko,
});

describe('toggleLine', () => {
  it('고르지 않은 줄은 더하고, 고른 줄은 뺀다', () => {
    expect(toggleLine([], 3)).toEqual([3]);
    expect(toggleLine([3, 5], 3)).toEqual([5]);
  });

  it('꽉 찬 채로 새 줄을 누르면 가장 먼저 고른 줄을 내린다', () => {
    expect(toggleLine([5, 1], 4)).toEqual([1, 4]);
  });

  it('모두 빼서 0줄이 될 수 있다', () => {
    expect(toggleLine([2], 2)).toEqual([]);
  });
});

describe('pickLines', () => {
  it('고른 순서와 무관하게 곡 순서대로 싣는다', () => {
    const lines = [line(0), line(1), line(2), line(3)];
    expect(pickLines(lines, [3, 1]).map((l) => l.index)).toEqual([1, 3]);
  });
});

describe('samePick', () => {
  it('순서가 달라도 같은 줄이면 같다', () => {
    expect(samePick([3, 1], [1, 3])).toBe(true);
    expect(samePick([1], [1, 3])).toBe(false);
  });
});

describe('lyricText', () => {
  it('후리가나를 떼고 이어 붙인다', () => {
    expect(lyricText(line(2))).toBe('夜の2');
  });
});

describe('lyricFitScale', () => {
  const textLine = (index: number, text: string): CardLyricLine => ({ index, ruby: [{ text }], ko: '' });

  it('들어가면 그대로 둔다', () => {
    expect(lyricFitScale([textLine(0, '夜の海')], 100, 10, 5)).toBe(1);
  });

  it('가장 긴 단이 높이에 딱 맞게 줄인다 — 뒤 단은 오프셋만큼 더 길다', () => {
    // 0단 6자 = 60, 1단 오프셋 20 + 5자 50 = 70
    expect(lyricFitScale([textLine(0, '一二三四五六'), textLine(1, '一二三四五')], 35, 10, 20)).toBeCloseTo(0.5);
  });

  it('가사가 없으면 1', () => {
    expect(lyricFitScale([], 10, 10, 5)).toBe(1);
  });
});

describe('lyricRowFitScale', () => {
  it('들어가면 그대로 둔다', () => {
    expect(lyricRowFitScale([line(0)], 100, 10, 4)).toBe(1);
  });

  it('가장 넓은 줄에 맞춰 줄인다 — 후리가나가 본문보다 넓으면 후리가나 폭을 쓴다', () => {
    // 夜(10) vs よる(2×6=12) → 12, の0(10 + 5.5) → 27.5
    expect(lyricRowFitScale([line(0)], 13.75, 10, 6)).toBeCloseTo(0.5);
  });
});

describe('textFitScale', () => {
  it('가장 넓은 문장에 맞춰 줄인다 — 반각은 절반 남짓으로 친다', () => {
    // 밤바다(30) vs 밤 a(10 + 5.5 + 5.5 = 21) → 30
    expect(textFitScale(['밤바다', '밤 a'], 15, 10)).toBeCloseTo(0.5);
    expect(textFitScale(['밤'], 15, 10)).toBe(1);
  });
});
