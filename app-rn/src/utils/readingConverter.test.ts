import { describe, expect, it } from 'vitest';
import { convertReading, katakanaToHiragana } from './readingConverter';

/**
 * These cases moved here from the lyric-translation prompt's `[PRONUNCIATION_OVERRIDE]` section.
 *
 * The pipeline used to ask the LLM for a Hangul transcription and spent a long prompt block forcing
 * voiceless K/T rows to aspirated Korean against 외래어 표기법's word-initial rule. The pipeline now
 * stores katakana and this function derives the Hangul, so that rule is code, and these are the cases
 * that pin it down.
 */
describe('convertReading KOREAN — voiceless K/T rows stay aspirated in any position', () => {
  const cases: [string, string][] = [
    ['クラゲ', '쿠라게'], // not 구라게
    ['ツキ', '츠키'], //     not 쓰키
    ['キミ', '키미'], //     not 기미
    ['キット', '킷토'], //   not 깃토 — and ッ becomes a ㅅ 받침
    ['ナツ', '나츠'], //     not 나쓰
    ['タダ', '타다'], //     not 다다
    ['クチ', '쿠치'], //     not 구치
    ['タエズ', '타에즈'], // not 다에즈
    ['アタマ', '아타마'], // mid-word タ, aspirated under either rule
    ['ダケ', '다케'], //     voiced ダ stays unaspirated
  ];

  for (const [katakana, korean] of cases) {
    it(`${katakana} → ${korean}`, () => {
      expect(convertReading(katakana, 'KOREAN')).toBe(korean);
    });
  }

  it('writes a long vowel as a hyphen rather than spelling out the second kana', () => {
    // The old prompt asked for ドウ → 도우. This function instead marks オ段+ウ as a long vowel, which
    // is the convention the rest of the app already displays (see admin-web's lyric fixtures).
    expect(convertReading('ドウ', 'KOREAN')).toBe('도-');
    expect(convertReading('ヨウ', 'KOREAN')).toBe('요-');
    expect(convertReading('セイ', 'KOREAN')).toBe('세-'); // エ段+イ
    expect(convertReading('カー', 'KOREAN')).toBe('카-'); // explicit chōon mark
  });

  it('turns ン into a ㄴ 받침 on the preceding syllable', () => {
    expect(convertReading('カンジ', 'KOREAN')).toBe('칸지');
    expect(convertReading('ホン', 'KOREAN')).toBe('혼');
  });

  it('leaves characters it has no mapping for alone', () => {
    expect(convertReading('yay', 'KOREAN')).toBe('yay');
    expect(convertReading('「ネコ」', 'KOREAN')).toBe('「네코」');
  });
});

describe('convertReading — the pipeline stores katakana, so every mode has something to convert from', () => {
  it('returns katakana unchanged', () => {
    expect(convertReading('イッテ', 'KATAKANA')).toBe('イッテ');
  });

  it('converts katakana to hiragana', () => {
    expect(convertReading('イッテ', 'HIRAGANA')).toBe('いって');
    expect(convertReading('タカイ', 'HIRAGANA')).toBe('たかい');
  });

  it('leaves non-kana untouched when converting to hiragana', () => {
    expect(katakanaToHiragana('ネコ yay 「」')).toBe('ねこ yay 「」');
  });
});
