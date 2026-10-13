import { describe, expect, it } from 'vitest';
import type { SongLyricLineDto, Token } from '../../types/song';
import { pickLineWords, pickSampleLyric } from './songCardSample';

function token(surface: string, charStart: number, reading: string | null): Token {
  return {
    surface, baseForm: surface, reading, baseFormReading: reading, partOfSpeech: 'NOUN',
    charStart, charEnd: charStart + surface.length, koreanText: null,
  };
}

function line(index: number, originalText: string, tokens: Token[], ko: string | null = '번역'): SongLyricLineDto {
  return { index, originalText, startTimeMs: null, koreanLyrics: ko, tokens } as SongLyricLineDto;
}

describe('pickSampleLyric', () => {
  it('가장 많이 반복되는 줄과 그 다음 다른 줄을 고르고, 한자에만 후리가나를 단다', () => {
    const lines = [
      line(0, '夜を', [token('夜', 0, 'ヨル')]),
      line(1, '光の中', [token('光', 0, 'ヒカリ'), token('の', 1, 'ノ'), token('中', 2, 'ナカ')]),
      line(2, '光の中', [token('光', 0, 'ヒカリ'), token('の', 1, 'ノ'), token('中', 2, 'ナカ')]),
      line(3, '走る', [token('走る', 0, 'ハシル')]),
    ];
    const picked = pickSampleLyric(lines);
    expect(picked.map(l => l.index)).toEqual([1, 3]);
    expect(picked[0].ruby).toEqual([
      { text: '光', reading: 'ひかり' },
      { text: 'の', reading: undefined },
      { text: '中', reading: 'なか' },
    ]);
  });

  it('번역이 없는 줄은 고르지 않는다', () => {
    expect(pickSampleLyric([line(0, '夜', [token('夜', 0, 'ヨル')], null)])).toEqual([]);
  });
});

describe('pickLineWords', () => {
  const word = (japanese: string, importanceScore: number, lineIndexes: number[], koreanText: string | null = '뜻') =>
    ({ japanese, reading: null, koreanText, importanceScore, lineIndexes });

  it('카드에 실린 줄에 나오는 단어만 중요한 순서로 고른다', () => {
    const words = [word('雨', 1, [0]), word('空', 9, [3]), word('風', 3, [2, 5]), word('夜', 2, [0, 2]), word('星', 5, [2], null)];
    expect(pickLineWords(words, [0, 2]).map(w => w.japanese)).toEqual(['風', '夜', '雨']);
  });
});
