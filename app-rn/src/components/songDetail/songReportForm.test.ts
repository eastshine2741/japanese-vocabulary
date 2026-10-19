import { describe, expect, it } from 'vitest';
import type { Token } from '../../types/song';
import type { SongReportTypeDto } from '../../types/songReport';
import {
  buildSongReportRequest,
  buildSongReportTokenChoices,
  canSubmitSongReport,
  selectSongReportTypes,
} from './songReportForm';

function type(overrides: Partial<SongReportTypeDto>): SongReportTypeDto {
  return {
    type: 'LYRIC_TEXT',
    group: 'LYRIC_LINE',
    label: '가사 원문이 달라요',
    targetKind: 'LINE',
    suggestionRequired: true,
    tokenPrompt: null,
    suggestionPlaceholder: '맞는 가사를 알려주세요',
    ...overrides,
  };
}

function token(overrides: Partial<Token>): Token {
  return {
    surface: '日',
    baseForm: '日',
    reading: 'ヒ',
    baseFormReading: 'ヒ',
    partOfSpeech: 'NOUN',
    charStart: 0,
    charEnd: 1,
    koreanText: '해',
    ...overrides,
  };
}

describe('selectSongReportTypes', () => {
  it('그룹에 속한 유형만 서버 순서대로 남긴다', () => {
    const types = [
      type({ type: 'LYRIC_TEXT' }),
      type({ type: 'MV_WRONG_SONG', group: 'MV', targetKind: 'NONE' }),
      type({ type: 'TRANSLATION' }),
    ];
    expect(selectSongReportTypes(types, 'LYRIC_LINE').map(t => t.type)).toEqual(['LYRIC_TEXT', 'TRANSLATION']);
    expect(selectSongReportTypes(types, 'MV').map(t => t.type)).toEqual(['MV_WRONG_SONG']);
  });
});

describe('buildSongReportTokenChoices', () => {
  it('공백 토큰은 고를 수 없다', () => {
    const choices = buildSongReportTokenChoices([
      token({ surface: '日', charStart: 0, charEnd: 1 }),
      token({ surface: ' ', charStart: 1, charEnd: 2 }),
    ]);
    expect(choices).toEqual([{ key: '0-1', surface: '日', charStart: 0, charEnd: 1 }]);
  });
});

describe('canSubmitSongReport', () => {
  it('설명이 필수인 유형은 설명이 비면 막는다', () => {
    expect(canSubmitSongReport(type({}), null, '   ')).toBe(false);
    expect(canSubmitSongReport(type({}), null, '맞는 가사')).toBe(true);
  });

  it('단어를 가리키는 유형은 단어를 고르기 전까지 막는다', () => {
    const furigana = type({ type: 'FURIGANA', targetKind: 'LINE_TOKEN' });
    expect(canSubmitSongReport(furigana, null, 'ひ')).toBe(false);
    expect(canSubmitSongReport(furigana, { key: '0-1', surface: '日', charStart: 0, charEnd: 1 }, 'ひ')).toBe(true);
  });

  it('설명이 선택인 유형은 설명 없이도 보낼 수 있다', () => {
    expect(canSubmitSongReport(type({ targetKind: 'NONE', suggestionRequired: false }), null, '')).toBe(true);
  });
});

describe('buildSongReportRequest', () => {
  it('줄 유형은 줄만, 토큰 유형은 토큰 오프셋까지 싣는다', () => {
    expect(buildSongReportRequest(type({}), ' 맞는 가사 ', 3, null)).toEqual({
      type: 'LYRIC_TEXT',
      target: { lineIndex: 3 },
      suggestion: '맞는 가사',
    });
    expect(buildSongReportRequest(
      type({ type: 'FURIGANA', targetKind: 'LINE_TOKEN' }),
      'ひ',
      3,
      { key: '0-1', surface: '日', charStart: 0, charEnd: 1 },
    )).toEqual({
      type: 'FURIGANA',
      target: { lineIndex: 3, charStart: 0, charEnd: 1 },
      suggestion: 'ひ',
    });
  });

  it('MV 유형은 target 없이, 빈 설명은 빼고 보낸다', () => {
    expect(buildSongReportRequest(
      type({ type: 'MV_WRONG_SONG', group: 'MV', targetKind: 'NONE', suggestionRequired: false }),
      '  ',
      null,
      null,
    )).toEqual({ type: 'MV_WRONG_SONG' });
  });
});
