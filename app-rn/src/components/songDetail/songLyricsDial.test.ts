import { describe, expect, it } from 'vitest';
import { Colors } from '../../theme/theme';
import { Token } from '../../types/song';
import {
  DEFAULT_LINE_HEIGHT,
  LINE_GAP,
  buildSlotLayouts,
  buildTokenCells,
  getTokenBarColor,
  stepTargetIndex,
} from './songLyricsDial';
import type { CurrentPlayingLyricLine, CurrentPlayingWord } from './CurrentPlayingWordsSheet';

function token(overrides: Partial<Token> & Pick<Token, 'surface' | 'charStart' | 'charEnd'>): Token {
  return {
    baseForm: overrides.surface,
    reading: null,
    baseFormReading: null,
    partOfSpeech: 'NOUN',
    koreanText: null,
    ...overrides,
  };
}

function line(
  originalText: string,
  tokens: Token[],
): CurrentPlayingLyricLine {
  return { index: 0, originalText, startTimeMs: 0, koreanLyrics: null, tokens };
}

describe('buildTokenCells', () => {
  it('토큰 사이에 분석 안 된 글자가 있으면 그 자리를 메워 원문 순서를 지킨다', () => {
    const cells = buildTokenCells(
      line('日が沈む', [
        token({ surface: '日', charStart: 0, charEnd: 1 }),
        token({ surface: '沈む', charStart: 2, charEnd: 4, partOfSpeech: 'VERB' }),
      ]),
      [],
    );

    expect(cells.map(cell => cell.text)).toEqual(['日', 'が', '沈む']);
    expect(cells[1].barColor).toBeNull();
  });

  it('마지막 토큰 뒤에 남은 글자도 떨어뜨리지 않는다', () => {
    const cells = buildTokenCells(
      line('空と', [token({ surface: '空', charStart: 0, charEnd: 1 })]),
      [],
    );

    expect(cells.map(cell => cell.text)).toEqual(['空', 'と']);
  });

  it('한자가 든 토큰에만 히라가나 후리가나를 붙인다', () => {
    const cells = buildTokenCells(
      line('君の', [
        token({ surface: '君', charStart: 0, charEnd: 1, reading: 'キミ' }),
        token({ surface: 'の', charStart: 1, charEnd: 2, reading: 'ノ', partOfSpeech: 'PARTICLE' }),
      ]),
      [],
    );

    expect(cells[0].furigana).toBe('きみ');
    expect(cells[1].furigana).toBeNull();
  });

  it('조사와 기호는 품사 색 띠를 두르지 않는다', () => {
    expect(getTokenBarColor('PARTICLE')).toBeNull();
    expect(getTokenBarColor('SYMBOL')).toBeNull();
    expect(getTokenBarColor(null)).toBeNull();
    expect(getTokenBarColor('VERB')).toBe(Colors.posVerb);
  });

  it('뜻은 토큰의 것을 먼저 쓰고, 없으면 그 줄 단어의 첫 뜻으로 채운다', () => {
    const word = {
      japanese: '姿',
      surface: '姿',
      baseForm: '姿',
      senses: [{ meaning: '모습' }],
    } as unknown as CurrentPlayingWord;
    const cells = buildTokenCells(
      line('姿空', [
        token({ surface: '姿', charStart: 0, charEnd: 1 }),
        token({ surface: '空', charStart: 1, charEnd: 2, koreanText: '하늘' }),
      ]),
      [word],
    );

    expect(cells[0].meaning).toBe('모습');
    expect(cells[0].word).toBe(word);
    expect(cells[1].meaning).toBe('하늘');
    expect(cells[1].word).toBeNull();
  });

  it('분석되지 않은 줄은 셀을 만들지 않는다 — 원문을 그대로 그린다', () => {
    expect(buildTokenCells(line('まだ分析前', []), [])).toEqual([]);
  });
});

describe('buildSlotLayouts', () => {
  it('잰 높이에 줄 간격을 더해 쌓는다', () => {
    const layouts = buildSlotLayouts(3, { 0: 26, 1: 180 });

    expect(layouts[0]).toEqual({ top: 0, height: 26 });
    expect(layouts[1]).toEqual({ top: 26 + LINE_GAP, height: 180 });
    expect(layouts[2]).toEqual({
      top: 26 + LINE_GAP + 180 + LINE_GAP,
      height: DEFAULT_LINE_HEIGHT,
    });
  });
});

describe('stepTargetIndex', () => {
  it('위로 끌면 다음 줄, 아래로 끌면 이전 줄', () => {
    expect(stepTargetIndex(5, -56, 20)).toBe(6);
    expect(stepTargetIndex(5, -168, 20)).toBe(8);
    expect(stepTargetIndex(5, 56, 20)).toBe(4);
  });

  it('한 칸에 못 미치는 드래그는 줄을 넘기지 않는다', () => {
    expect(stepTargetIndex(5, -20, 20)).toBe(5);
  });

  it('가사 양 끝을 넘어가지 않는다', () => {
    expect(stepTargetIndex(1, 1000, 20)).toBe(0);
    expect(stepTargetIndex(18, -1000, 20)).toBe(19);
  });
});
