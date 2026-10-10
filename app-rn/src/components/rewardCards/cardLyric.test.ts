import { describe, expect, it } from 'vitest';
import { lyricKo, lyricText, pickLines, samePick, toggleLine } from './cardLyric';
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

describe('lyricText / lyricKo', () => {
  it('후리가나를 떼고 이어 붙이고, 번역은 / 로 잇는다', () => {
    expect(lyricText(line(2))).toBe('夜の2');
    expect(lyricKo([line(0, '밤'), line(1, '바다')])).toBe('밤 / 바다');
  });
});
