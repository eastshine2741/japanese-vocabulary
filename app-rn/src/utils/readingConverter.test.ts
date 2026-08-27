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

  it('spends the long vowel, so the next kana starts a syllable of its own', () => {
    // 永遠 came out 에--: the second エ lengthened the same vowel again instead of being read.
    expect(convertReading('エイエン', 'KOREAN')).toBe('에-엔');
  });

  it('turns ン into a ㄴ 받침 on the preceding syllable', () => {
    expect(convertReading('カンジ', 'KOREAN')).toBe('칸지');
    expect(convertReading('ホン', 'KOREAN')).toBe('혼');
  });

  it('spells a long vowel out when a 받침 has to land on it', () => {
    // A hyphen cannot carry one: ワンシーン ended in an orphan jamo (완시-ㄴ) and せいって put the
    // 촉음 before the length (셋-테).
    expect(convertReading('ワンシーン', 'KOREAN')).toBe('완시인');
    expect(convertReading('セイッテ', 'KOREAN')).toBe('세잇테');
  });

  it('drops a 촉음 that has no syllable to sit on', () => {
    // 완 already carries ㄴ, and Korean cannot write a second one. It used to print 완ッ테.
    expect(convertReading('クワンッテ', 'KOREAN')).toBe('쿠완테');
    expect(convertReading('ッテ', 'KOREAN')).toBe('테');
  });

  it('reads a loanword combination as one syllable', () => {
    // イェイ read 이에-: the small ェ became its own syllable and the trailing イ lengthened it.
    expect(convertReading('イェイ', 'KOREAN')).toBe('예이');
    expect(convertReading('パーティ', 'KOREAN')).toBe('파-티');
    expect(convertReading('フォーク', 'KOREAN')).toBe('포-쿠');
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

/** Tokens as the pipeline emits them: position in the raw line + the reading actually sung. */
const token = (
  surface: string,
  reading: string,
  charStart: number,
  partOfSpeech?: string,
): ReadingToken => ({ surface, reading, charStart, charEnd: charStart + surface.length, partOfSpeech });

describe('convertLineReading — a long vowel belongs to one word, so conversion stops at the boundary', () => {
  it('keeps the next word\'s leading ウ out of the previous word\'s vowel', () => {
    // ボクノ + ウタ. Converted as one string the ウ extends ノ and 歌 loses its first syllable.
    expect(convertLineReading('僕の歌', [token('僕の', 'ボクノ', 0), token('歌', 'ウタ', 2)], 'KOREAN'))
      .toBe('보쿠노 우타');
  });

  it('keeps the next word\'s leading イ out of an エ段 ending', () => {
    expect(convertLineReading('ねいつか', [token('ね', 'ネ', 0), token('いつか', 'イツカ', 1)], 'KOREAN'))
      .toBe('네 이츠카');
  });

  it('does not let a chōon mark reach past the word it ends', () => {
    // The ー keeps its vowel row alive, so a line-wide pass folded 歌う's ウ in as a second 長音.
    expect(convertLineReading('もう歌う', [token('もう', 'モー', 0), token('歌う', 'ウタウ', 2)], 'KOREAN'))
      .toBe('모- 우타우');
  });

  it('still marks a long vowel inside a single word', () => {
    expect(convertLineReading('東京', [token('東京', 'トウキョウ', 0)], 'KOREAN')).toBe('토-쿄-');
  });
});

describe('convertLineReading — a 받침 belongs to the syllable before it, even across tokens', () => {
  it('carries a leading 촉음 onto the previous token\'s last syllable', () => {
    // Segmentation splits だって into だ + って, and per-token conversion left the kana: 다ッ테.
    expect(convertLineReading('散々だって', [token('散々', 'サンザン', 0), token('だ', 'ダ', 2),
      token('って', 'ッテ', 3, 'PARTICLE')], 'KOREAN')).toBe('산잔닷테');
  });

  it('carries a leading ン onto the previous token\'s last syllable', () => {
    expect(convertLineReading('どこなんだ', [token('どこ', 'ドコ', 0), token('な', 'ナ', 2),
      token('んだ', 'ンダ', 3, 'AUXILIARY_VERB')], 'KOREAN')).toBe('도코 난다');
  });
});

describe('convertLineReading — Japanese writes no spaces, so the words are separated here', () => {
  it('separates one content word from the next', () => {
    expect(convertLineReading('夕暮れは悲しい', [token('夕暮れ', 'ユウグレ', 0),
      token('は', 'ワ', 3, 'PARTICLE'), token('悲しい', 'カナシイ', 4)], 'KOREAN'))
      .toBe('유-구레와 카나시-');
  });

  it('keeps grammar attached to the word in front of it', () => {
    expect(convertLineReading('僕の歌を', [token('僕', 'ボク', 0), token('の', 'ノ', 1, 'PARTICLE'),
      token('歌', 'ウタ', 2), token('を', 'ヲ', 3, 'PARTICLE')], 'KOREAN')).toBe('보쿠노 우타오');
  });

  it('keeps an all-hiragana token attached to the word it inflects', () => {
    // 揺ら + せば is one verb to a reader.
    expect(convertLineReading('揺らせば', [token('揺ら', 'ユラ', 0), token('せば', 'セバ', 2)], 'KOREAN'))
      .toBe('유라세바');
  });

  it('copies the text between tokens verbatim, the way the server assembles the line', () => {
    const tokens = [token('風', 'カゼ', 0), token('吹く', 'フク', 2)];
    expect(convertLineReading('風 吹く', tokens, 'KOREAN')).toBe('카제 후쿠');
  });

  it('keeps text before the first token and after the last', () => {
    expect(convertLineReading('「ネコ」', [token('ネコ', 'ネコ', 1)], 'KOREAN')).toBe('「네코」');
  });

  it('assembles hiragana and katakana lines the same way', () => {
    const tokens = [token('僕の', 'ボクノ', 0), token('歌', 'ウタ', 2)];
    expect(convertLineReading('僕の歌', tokens, 'HIRAGANA')).toBe('ぼくの うた');
    expect(convertLineReading('僕の歌', tokens, 'KATAKANA')).toBe('ボクノ ウタ');
  });
});

describe('convertLineReading — text no token claimed has no reading to show', () => {
  it('reads a word break where an ad-lib was left uncovered', () => {
    // Copying the uncovered text through put Japanese in the Korean line: 사케베べ베노무.
    expect(convertLineReading('叫べべベノム', [token('叫べ', 'サケベ', 0), token('ベノム', 'ベノム', 3)],
      'KOREAN')).toBe('사케베 베노무');
  });

  it('drops a ruby gloss instead of reading it a second time', () => {
    expect(convertLineReading('病名(なまえ)', [token('病名', 'ビョウメイ', 0)], 'KOREAN')).toBe('뵤-메-');
  });

  it('keeps a parenthesised ad-lib the analysis did tokenise', () => {
    expect(convertLineReading('変われ（ズキズキ）', [token('変われ', 'カワレ', 0),
      token('ズキズキ', 'ズキズキ', 4)], 'KOREAN')).toBe('카와레（즈키즈키）');
  });

  it('has nothing to assemble when analysis produced no tokens', () => {
    // The caller reads this as "no reading" and draws nothing.
    expect(convertLineReading('la la la', [], 'KOREAN')).toBe('');
  });

  it('reads a token with no reading of its own by its surface', () => {
    expect(convertLineReading('Oh 恋', [{ surface: 'Oh', reading: null, charStart: 0, charEnd: 2 },
      token('恋', 'コイ', 3)], 'KOREAN')).toBe('Oh 코이');
  });
});
