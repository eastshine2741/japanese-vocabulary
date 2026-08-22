import { describe, expect, it } from 'vitest';
import { ReadingToken, convertLineReading, convertReading, katakanaToHiragana } from './readingConverter';

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

describe('convertLineReading — a long vowel belongs to one word, so conversion stops at the boundary', () => {
  /** Tokens as the pipeline emits them: position in the raw line + the reading actually sung. */
  const token = (surface: string, reading: string, charStart: number): ReadingToken =>
    ({ surface, reading, charStart, charEnd: charStart + surface.length });

  it('keeps the next word\'s leading ウ out of the previous word\'s vowel', () => {
    // ボクノ + ウタ. Converted as one string the ウ extends ノ and 歌 loses its first syllable.
    expect(convertLineReading('僕の歌', [token('僕の', 'ボクノ', 0), token('歌', 'ウタ', 2)], 'KOREAN'))
      .toBe('보쿠노우타');
  });

  it('keeps the next word\'s leading イ out of an エ段 ending', () => {
    expect(convertLineReading('ねいつか', [token('ね', 'ネ', 0), token('いつか', 'イツカ', 1)], 'KOREAN'))
      .toBe('네이츠카');
  });

  it('does not let a chōon mark reach past the word it ends', () => {
    // The ー keeps its vowel row alive, so a line-wide pass folded 歌う's ウ in as a second長音.
    expect(convertLineReading('もう歌う', [token('もう', 'モー', 0), token('歌う', 'ウタウ', 2)], 'KOREAN'))
      .toBe('모-우타우');
  });

  it('still marks a long vowel inside a single word', () => {
    expect(convertLineReading('東京', [token('東京', 'トウキョウ', 0)], 'KOREAN')).toBe('토-쿄-');
  });

  it('copies the text between tokens verbatim, the way the server assembles the line', () => {
    const tokens = [token('風', 'カゼ', 0), token('吹く', 'フク', 2)];
    expect(convertLineReading('風 吹く', tokens, 'KOREAN')).toBe('카제 후쿠');
  });

  it('keeps text before the first token and after the last', () => {
    expect(convertLineReading('「ネコ」', [token('ネコ', 'ネコ', 1)], 'KOREAN')).toBe('「네코」');
  });

  it('falls back to the line itself when analysis produced no tokens', () => {
    expect(convertLineReading('la la la', [], 'KOREAN')).toBe('la la la');
  });

  it('reads a token with no reading of its own by its surface', () => {
    expect(convertLineReading('Oh 恋', [{ surface: 'Oh', reading: null, charStart: 0, charEnd: 2 },
      token('恋', 'コイ', 3)], 'KOREAN')).toBe('Oh 코이');
  });

  it('assembles hiragana and katakana lines the same way', () => {
    const tokens = [token('僕の', 'ボクノ', 0), token('歌', 'ウタ', 2)];
    expect(convertLineReading('僕の歌', tokens, 'HIRAGANA')).toBe('ぼくのうた');
    expect(convertLineReading('僕の歌', tokens, 'KATAKANA')).toBe('ボクノウタ');
  });
});
