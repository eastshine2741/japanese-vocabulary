import { describe, expect, it } from 'vitest';
import type { SongLyricLineDto, SongWordTierDto, WordInSongItemDto } from '../../types/song';
import { buildStudyLines, firstLockedPosition, isWordSeen, lastReachablePosition, lineWordKeys, snapLineIndex } from './studyLines';

function line(index: number, startTimeMs: number | null): SongLyricLineDto {
  return { index, originalText: `line${index}`, startTimeMs, koreanLyrics: null, tokens: [] };
}

function word(japanese: string, saved = false, saveKey = japanese): WordInSongItemDto {
  return {
    japanese,
    surface: japanese,
    baseForm: null,
    reading: null,
    koreanText: null,
    senses: [],
    partOfSpeech: '',
    partOfSpeechLabel: '',
    jlpt: null,
    importanceScore: 0,
    appearanceOrder: 0,
    frequency: 1,
    lineIndexes: [],
    isSavedGlobally: false,
    isSavedForSong: saved,
    savedWordId: null,
    addRequest: { japanese: saveKey, senses: [] },
    isStudied: saved,
  };
}

function tier(wordJapanese: string[]): SongWordTierDto {
  return {
    key: 'CHORUS',
    order: 1,
    name: '',
    description: '',
    wordJapanese,
    totalCount: wordJapanese.length,
    knownCount: 0,
    learningCount: 0,
    longTermCount: 0,
    shortTermCount: 0,
    dueCount: 0,
    duePreviewWords: [],
  };
}

describe('buildStudyLines', () => {
  it('tier 단어가 없는 줄은 열린 줄로 남기고 빈 줄만 뺀다', () => {
    const words = [word('胸'), word('ラ'), word('声')];
    const result = buildStudyLines(
      [line(0, 0), line(1, 1000), { ...line(2, 2000), originalText: ' ' }],
      words,
      { 0: [1], 1: [2, 0, 2] },
      [tier(['胸', '声'])],
    );
    expect(result.map(l => [l.line.index, l.unseenCount])).toEqual([[0, 0], [1, 2]]);
    expect(result[1].words.map(w => w.japanese)).toEqual(['声', '胸']);
  });

  it('구간은 다음 줄 시작까지, 마지막 줄은 고정 길이다', () => {
    const result = buildStudyLines(
      [line(0, 1000), line(1, 4000)],
      [word('胸')],
      { 0: [0], 1: [0] },
      [tier(['胸'])],
    );
    expect(result.map(l => [l.clipStartMs, l.clipEndMs])).toEqual([[1000, 4000], [4000, 12000]]);
  });

  it('시각이 없는 가사는 구간이 없다', () => {
    const [only] = buildStudyLines([line(0, null)], [word('胸')], { 0: [0] }, [tier(['胸'])]);
    expect(only.clipStartMs).toBeNull();
    expect(only.clipEndMs).toBeNull();
  });

  it('담긴 단어만 남은 줄이 열린 줄이다', () => {
    const result = buildStudyLines(
      [line(0, 0), line(1, 1000)],
      [word('胸', true), word('声')],
      { 0: [0], 1: [0, 1] },
      [tier(['胸', '声'])],
    );
    expect(result.map(l => l.unseenCount)).toEqual([0, 1]);
    expect(firstLockedPosition(result)).toBe(1);
  });
});

describe('lastReachablePosition', () => {
  const lines = (unseen: number[]) => buildStudyLines(
    unseen.map((_, i) => line(i, i * 1000)),
    [word('胸', true), word('声')],
    Object.fromEntries(unseen.map((count, i) => [i, count > 0 ? [0, 1] : [0]])),
    [tier(['胸', '声'])],
  );

  it('가장 멀리 간 줄이 열려 있으면 다음 줄까지 간다. 다음 줄이 잠겨 있어도 간다', () => {
    expect(lastReachablePosition(lines([0, 1, 0]), 0)).toBe(1);
  });

  it('가장 멀리 간 줄이 잠겨 있으면 그 줄에서 멈춘다', () => {
    expect(lastReachablePosition(lines([0, 1, 0]), 1)).toBe(1);
  });

  it('마지막 줄 너머로는 가지 않는다', () => {
    expect(lastReachablePosition(lines([0, 0]), 1)).toBe(1);
  });
});

describe('lineWordKeys', () => {
  it('저장 키와 표기를 함께 싣는다', () => {
    const [only] = buildStudyLines([line(0, 0)], [word('響く', false, '響く(ひびく)')], { 0: [0] }, [tier(['響く'])]);
    expect(lineWordKeys(only)).toEqual(['響く(ひびく)', '響く']);
  });
});

describe('isWordSeen', () => {
  it('담기만 하고 리뷰하지 않은 단어는 안 본 단어다', () => {
    expect(isWordSeen({ ...word('a', true), isStudied: false })).toBe(false);
  });

  it('구버전 서버면 담김 여부로 판정한다', () => {
    const { isStudied: _, ...legacy } = word('a', true);
    expect(isWordSeen(legacy)).toBe(true);
  });
});

describe('snapLineIndex', () => {
  // 줄 위쪽 0, 60, 120, 180. 지금 줄 자리는 84.
  const tops = [0, 60, 120, 180];
  const restOf = (index: number) => 84 - tops[index];

  it('손 뗀 자리에서 가장 가까운 줄로 앉는다', () => {
    expect(snapLineIndex(tops, restOf(3) + 100, 84, 3, 0, 3)).toBe(1);
  });

  it('조금만 끌다 놓으면 원래 줄로 돌아온다', () => {
    expect(snapLineIndex(tops, restOf(3) + 20, 84, 3, 0, 3)).toBe(3);
  });

  it('빠르게 튕기면 한 줄 넘긴다', () => {
    expect(snapLineIndex(tops, restOf(3) + 20, 84, 3, 900, 3)).toBe(2);
    expect(snapLineIndex(tops, restOf(1) - 20, 84, 1, -900, 3)).toBe(2);
  });

  it('아직 안 온 줄로는 가지 않는다', () => {
    expect(snapLineIndex(tops, restOf(2) - 200, 84, 2, -900, 2)).toBe(2);
  });

  it('첫 줄 앞으로는 가지 않는다', () => {
    expect(snapLineIndex(tops, restOf(0) + 30, 84, 0, 900, 3)).toBe(0);
  });
});
