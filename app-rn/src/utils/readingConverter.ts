export type ReadingDisplay = 'KATAKANA' | 'HIRAGANA' | 'KOREAN';

export function katakanaToHiragana(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // カタカナ range: U+30A1 (ァ) ~ U+30F6 (ヶ)
    if (code >= 0x30a1 && code <= 0x30f6) {
      result += String.fromCharCode(code - 0x60);
    } else {
      result += text[i];
    }
  }
  return result;
}

// 2-char combinations (must be checked before single chars)
const YOON_MAP: Record<string, string> = {
  'キャ': '캬', 'キュ': '큐', 'キョ': '쿄',
  'シャ': '샤', 'シュ': '슈', 'ショ': '쇼',
  'チャ': '차', 'チュ': '추', 'チョ': '초',
  'ニャ': '냐', 'ニュ': '뉴', 'ニョ': '뇨',
  'ヒャ': '햐', 'ヒュ': '휴', 'ヒョ': '효',
  'ミャ': '먀', 'ミュ': '뮤', 'ミョ': '묘',
  'リャ': '랴', 'リュ': '류', 'リョ': '료',
  'ギャ': '갸', 'ギュ': '규', 'ギョ': '교',
  'ジャ': '자', 'ジュ': '주', 'ジョ': '조',
  'ビャ': '뱌', 'ビュ': '뷰', 'ビョ': '뵤',
  'ピャ': '퍄', 'ピュ': '퓨', 'ピョ': '표',
  // Loanword sounds: without these the small kana becomes its own syllable (イェイ → 이에-).
  'イェ': '예',
  'ウィ': '위', 'ウェ': '웨', 'ウォ': '워',
  'シェ': '셰', 'ジェ': '제', 'チェ': '체',
  'ティ': '티', 'トゥ': '투', 'ディ': '디', 'ドゥ': '두',
  'ファ': '파', 'フィ': '피', 'フェ': '페', 'フォ': '포',
  'ツァ': '차', 'ツェ': '체', 'ツォ': '초',
};

// Single-char kana mapping
const KANA_MAP: Record<string, string> = {
  // vowels
  'ア': '아', 'イ': '이', 'ウ': '우', 'エ': '에', 'オ': '오',
  // ka row
  'カ': '카', 'キ': '키', 'ク': '쿠', 'ケ': '케', 'コ': '코',
  // sa row
  'サ': '사', 'シ': '시', 'ス': '스', 'セ': '세', 'ソ': '소',
  // ta row
  'タ': '타', 'チ': '치', 'ツ': '츠', 'テ': '테', 'ト': '토',
  // na row
  'ナ': '나', 'ニ': '니', 'ヌ': '누', 'ネ': '네', 'ノ': '노',
  // ha row
  'ハ': '하', 'ヒ': '히', 'フ': '후', 'ヘ': '헤', 'ホ': '호',
  // ma row
  'マ': '마', 'ミ': '미', 'ム': '무', 'メ': '메', 'モ': '모',
  // ya row
  'ヤ': '야', 'ユ': '유', 'ヨ': '요',
  // ra row
  'ラ': '라', 'リ': '리', 'ル': '루', 'レ': '레', 'ロ': '로',
  // wa row
  'ワ': '와', 'ヲ': '오',
  // dakuten (ga, za, da, ba)
  'ガ': '가', 'ギ': '기', 'グ': '구', 'ゲ': '게', 'ゴ': '고',
  'ザ': '자', 'ジ': '지', 'ズ': '즈', 'ゼ': '제', 'ゾ': '조',
  'ダ': '다', 'ヂ': '지', 'ヅ': '즈', 'デ': '데', 'ド': '도',
  'バ': '바', 'ビ': '비', 'ブ': '부', 'ベ': '베', 'ボ': '보',
  // handakuten (pa)
  'パ': '파', 'ピ': '피', 'プ': '푸', 'ペ': '페', 'ポ': '포',
  // small kana
  'ァ': '아', 'ィ': '이', 'ゥ': '우', 'ェ': '에', 'ォ': '오',
  'ャ': '야', 'ュ': '유', 'ョ': '요',
};

// Vowel row for each kana (used for long vowel detection)
type VowelRow = 'a' | 'i' | 'u' | 'e' | 'o';

const VOWEL_ROW: Record<string, VowelRow> = {
  'ア': 'a', 'カ': 'a', 'サ': 'a', 'タ': 'a', 'ナ': 'a', 'ハ': 'a', 'マ': 'a', 'ヤ': 'a', 'ラ': 'a', 'ワ': 'a',
  'ガ': 'a', 'ザ': 'a', 'ダ': 'a', 'バ': 'a', 'パ': 'a', 'ァ': 'a', 'ャ': 'a',
  'イ': 'i', 'キ': 'i', 'シ': 'i', 'チ': 'i', 'ニ': 'i', 'ヒ': 'i', 'ミ': 'i', 'リ': 'i',
  'ギ': 'i', 'ジ': 'i', 'ヂ': 'i', 'ビ': 'i', 'ピ': 'i', 'ィ': 'i',
  'ウ': 'u', 'ク': 'u', 'ス': 'u', 'ツ': 'u', 'ヌ': 'u', 'フ': 'u', 'ム': 'u', 'ユ': 'u', 'ル': 'u',
  'グ': 'u', 'ズ': 'u', 'ヅ': 'u', 'ブ': 'u', 'プ': 'u', 'ゥ': 'u', 'ュ': 'u',
  'エ': 'e', 'ケ': 'e', 'セ': 'e', 'テ': 'e', 'ネ': 'e', 'ヘ': 'e', 'メ': 'e', 'レ': 'e',
  'ゲ': 'e', 'ゼ': 'e', 'デ': 'e', 'ベ': 'e', 'ペ': 'e', 'ェ': 'e',
  'オ': 'o', 'コ': 'o', 'ソ': 'o', 'ト': 'o', 'ノ': 'o', 'ホ': 'o', 'モ': 'o', 'ヨ': 'o', 'ロ': 'o',
  'ゴ': 'o', 'ゾ': 'o', 'ド': 'o', 'ボ': 'o', 'ポ': 'o', 'ヲ': 'o', 'ォ': 'o', 'ョ': 'o',
};

// Yōon vowel rows (the combination's vowel is determined by the small kana)
const YOON_VOWEL: Record<string, VowelRow> = {
  'キャ': 'a', 'キュ': 'u', 'キョ': 'o',
  'シャ': 'a', 'シュ': 'u', 'ショ': 'o',
  'チャ': 'a', 'チュ': 'u', 'チョ': 'o',
  'ニャ': 'a', 'ニュ': 'u', 'ニョ': 'o',
  'ヒャ': 'a', 'ヒュ': 'u', 'ヒョ': 'o',
  'ミャ': 'a', 'ミュ': 'u', 'ミョ': 'o',
  'リャ': 'a', 'リュ': 'u', 'リョ': 'o',
  'ギャ': 'a', 'ギュ': 'u', 'ギョ': 'o',
  'ジャ': 'a', 'ジュ': 'u', 'ジョ': 'o',
  'ビャ': 'a', 'ビュ': 'u', 'ビョ': 'o',
  'ピャ': 'a', 'ピュ': 'u', 'ピョ': 'o',
  'イェ': 'e',
  'ウィ': 'i', 'ウェ': 'e', 'ウォ': 'o',
  'シェ': 'e', 'ジェ': 'e', 'チェ': 'e',
  'ティ': 'i', 'トゥ': 'u', 'ディ': 'i', 'ドゥ': 'u',
  'ファ': 'a', 'フィ': 'i', 'フェ': 'e', 'フォ': 'o',
  'ツァ': 'a', 'ツェ': 'e', 'ツォ': 'o',
};

/**
 * Loanword pairs, as opposed to native yōon. Loanwords write length with ー, so a vowel kana after
 * one of these is its own syllable (イェイ is yay, not ye-) where キョウ is one long syllable.
 */
const LOANWORD_PAIRS = new Set([
  'イェ',
  'ウィ', 'ウェ', 'ウォ',
  'シェ', 'ジェ', 'チェ',
  'ティ', 'トゥ', 'ディ', 'ドゥ',
  'ファ', 'フィ', 'フェ', 'フォ',
  'ツァ', 'ツェ', 'ツォ',
]);

// Which vowel rows each vowel kana can extend as a long vowel
const LONG_VOWEL_EXTENDS: Record<string, VowelRow[]> = {
  'ア': ['a'],
  'イ': ['i', 'e'],  // エ段+イ = long e (e.g., セイ)
  'ウ': ['u', 'o'],  // オ段+ウ = long o (e.g., コウ)
  'エ': ['e'],
  'オ': ['o'],
};

const LONG_VOWEL_SIGN = '-';

/** The syllable a long vowel repeats, per vowel row. */
const PLAIN_VOWEL: Record<VowelRow, string> = { a: '아', i: '이', u: '우', e: '에', o: '오' };

// 종성 (받침) indices in Korean Unicode block
const JONGSEONG_NIEUN = 4;  // ㄴ
const JONGSEONG_SIOT = 19;  // ㅅ

/**
 * Syllables written so far. `long` marks the ones that only repeat the vowel before them: they show
 * as `-`, unless a 받침 lands on one — spelling the vowel out is the only way Korean can write that
 * (せい + って → 세잇테, where 세- had nowhere to put the 촉음).
 */
interface SyllableBuffer {
  out: string[];
  long: Set<number>;
}

function pushLongVowel(buffer: SyllableBuffer, syllable: string): void {
  buffer.long.add(buffer.out.length);
  buffer.out.push(syllable);
}

function render(buffer: SyllableBuffer): string {
  return buffer.out.map((syllable, i) => (buffer.long.has(i) ? LONG_VOWEL_SIGN : syllable)).join('');
}

/**
 * Put a 받침 on the syllable just written. False when there is none to take it: one already carrying
 * a 받침 (완 + ッ), copied punctuation (…わ！ + って), or nothing written yet.
 */
function attachBatchim(buffer: SyllableBuffer, jongseongIndex: number): boolean {
  const last = buffer.out.length - 1;
  if (last < 0) return false;
  const syllable = buffer.out[last];
  if (syllable.length !== 1) return false;
  const code = syllable.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  if ((code - 0xac00) % 28 !== 0) return false;
  buffer.out[last] = String.fromCharCode(code + jongseongIndex);
  buffer.long.delete(last);
  return true;
}

/**
 * Write one reading as Korean syllables, appending to [buffer].
 *
 * One syllable per element so a 받침 can reach back across a token boundary (だ + って → 닷테). The
 * long vowel state starts fresh instead, or one word's vowel eats the next word's ウ/イ
 * (ボクノ + ウタ → 보쿠노-타).
 */
function appendKorean(buffer: SyllableBuffer, text: string): void {
  let prevVowelRow: VowelRow | null = null;
  // Whether a vowel *kana* may lengthen what came before. ー is separate: it lengthens anything.
  let kanaLengthenable = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    // ー (chōon mark) → long vowel
    if (ch === 'ー') {
      if (prevVowelRow) pushLongVowel(buffer, PLAIN_VOWEL[prevVowelRow]);
      else buffer.out.push(ch);
      // prevVowelRow stays the same (장음 뒤에 또 장음 가능)
      i++;
      continue;
    }

    // Long vowel: vowel kana extending previous syllable's vowel row
    const extends_ = LONG_VOWEL_EXTENDS[ch];
    if (extends_ && prevVowelRow && kanaLengthenable && extends_.includes(prevVowelRow)) {
      pushLongVowel(buffer, KANA_MAP[ch]);
      // Spent: letting it stand let the next vowel kana extend it too (エイエン → 에--).
      prevVowelRow = null;
      kanaLengthenable = false;
      i++;
      continue;
    }

    // ン → ㄴ 받침 on the preceding syllable
    if (ch === 'ン') {
      // With nowhere to sit, 응 keeps the mora audible where a bare ㄴ reads as a broken glyph.
      if (!attachBatchim(buffer, JONGSEONG_NIEUN)) buffer.out.push('응');
      i++;
      prevVowelRow = null;
      kanaLengthenable = false;
      continue;
    }

    // ッ → ㅅ 받침 on the preceding syllable (촉음, 외래어표기법)
    if (ch === 'ッ') {
      // Dropped when nothing can take it (喰わん + って → 쿠완테): Korean tenses the next consonant
      // instead and cannot write a second 받침.
      attachBatchim(buffer, JONGSEONG_SIOT);
      i++;
      prevVowelRow = null;
      kanaLengthenable = false;
      continue;
    }

    // try 2-char combination match first
    if (i + 1 < text.length) {
      const pair = ch + text[i + 1];
      if (YOON_MAP[pair]) {
        buffer.out.push(YOON_MAP[pair]);
        prevVowelRow = YOON_VOWEL[pair] ?? null;
        kanaLengthenable = !LOANWORD_PAIRS.has(pair);
        i += 2;
        continue;
      }
    }

    // single-char match
    if (KANA_MAP[ch]) {
      buffer.out.push(KANA_MAP[ch]);
      prevVowelRow = VOWEL_ROW[ch] ?? null;
      kanaLengthenable = true;
    } else {
      buffer.out.push(ch);
      prevVowelRow = null;
      kanaLengthenable = false;
    }
    i++;
  }
}

export function convertReading(text: string, display: ReadingDisplay): string {
  if (display === 'KATAKANA') return text;
  if (display === 'HIRAGANA') return katakanaToHiragana(text);
  const buffer: SyllableBuffer = { out: [], long: new Set() };
  appendKorean(buffer, text);
  return render(buffer);
}

/** The token fields a line's reading is assembled from. Structurally satisfied by `Token`. */
export interface ReadingToken {
  surface: string;
  reading: string | null;
  charStart: number;
  charEnd: number;
  partOfSpeech?: string;
}

/** Parts of speech that are read as part of the word in front of them, never as a word of their own. */
const GLUED_POS = new Set(['PARTICLE', 'AUXILIARY_VERB', 'SUFFIX']);

const HIRAGANA_ONLY = /^[ぁ-ゖー]+$/;

const JAPANESE = /[぀-ヿ㐀-鿿]/;

/**
 * Whether a space goes in front of [token]. Japanese writes none, so the whole line arrived as one
 * run. Segmentation splits finer than a reader reads, so grammar stays attached: particles,
 * auxiliaries and suffixes, a reading opening with ッ/ン, and an all-hiragana surface after one that
 * is not — that is inflection (揺ら + せば).
 */
function startsNewWord(token: ReadingToken, previous: ReadingToken | null): boolean {
  if (previous == null) return false;
  if (token.partOfSpeech != null && GLUED_POS.has(token.partOfSpeech)) return false;
  const reading = token.reading ?? token.surface;
  if (reading.startsWith('ッ') || reading.startsWith('ン')) return false;
  if (HIRAGANA_ONLY.test(token.surface) && !HIRAGANA_ONLY.test(previous.surface)) return false;
  return true;
}

/**
 * Text between two tokens: punctuation and latin runs are copied to hold the line's shape, but
 * Japanese no token claimed (an ad-lib, a ruby gloss) has no reading and would put Japanese in the
 * middle of a Korean line (叫べべベノム → 사케베べ베노무), so it becomes a word break.
 */
function separatorFor(text: string): string {
  return JAPANESE.test(text) ? ' ' : text;
}

function appendReading(buffer: SyllableBuffer, reading: string, display: ReadingDisplay): void {
  if (display === 'KOREAN') {
    appendKorean(buffer, reading);
    return;
  }
  buffer.out.push(display === 'HIRAGANA' ? katakanaToHiragana(reading) : reading);
}

/**
 * A lyric line's reading, assembled from its tokens in position order — the analysis stores no line
 * reading. See [startsNewWord] and [separatorFor] for what goes between them.
 *
 * Empty when the line has no tokens; the caller then shows no reading rather than passing the
 * Japanese text off as one.
 */
export function convertLineReading(
  originalText: string,
  tokens: readonly ReadingToken[],
  display: ReadingDisplay,
): string {
  if (tokens.length === 0) return '';

  const buffer: SyllableBuffer = { out: [], long: new Set() };
  let cursor = 0;
  let previous: ReadingToken | null = null;
  for (const token of [...tokens].sort((a, b) => a.charStart - b.charStart)) {
    if (token.charStart > cursor) {
      buffer.out.push(separatorFor(originalText.slice(cursor, token.charStart)));
    } else if (startsNewWord(token, previous)) {
      buffer.out.push(' ');
    }
    appendReading(buffer, token.reading ?? token.surface, display);
    cursor = Math.max(cursor, token.charEnd);
    previous = token;
  }
  if (cursor < originalText.length) {
    buffer.out.push(separatorFor(originalText.slice(cursor)));
  }
  return render(buffer).replace(/ {2,}/g, ' ').trim();
}
