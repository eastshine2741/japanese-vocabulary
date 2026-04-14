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

// 2-char yōon combinations (must be checked before single chars)
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
};

// Which vowel rows each vowel kana can extend as a long vowel
const LONG_VOWEL_EXTENDS: Record<string, VowelRow[]> = {
  'ア': ['a'],
  'イ': ['i', 'e'],  // エ段+イ = long e (e.g., セイ)
  'ウ': ['u', 'o'],  // オ段+ウ = long o (e.g., コウ)
  'エ': ['e'],
  'オ': ['o'],
};

// 종성 (받침) indices in Korean Unicode block
const JONGSEONG_NIEUN = 4;  // ㄴ
const JONGSEONG_SIOT = 19;  // ㅅ

/**
 * Add a 받침 (final consonant) to a Korean syllable.
 * Korean syllable = 0xAC00 + (초성*21 + 중성)*28 + 종성
 * If the char already has 받침 or isn't a Korean syllable, returns null.
 */
function addBatchim(char: string, jongseongIndex: number): string | null {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  if ((code - 0xac00) % 28 !== 0) return null; // already has 받침
  return String.fromCharCode(code + jongseongIndex);
}

function katakanaToKorean(text: string): string {
  const result: string[] = [];
  let prevVowelRow: VowelRow | null = null;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    // ー (chōon mark) → long vowel
    if (ch === 'ー') {
      if (prevVowelRow) {
        result.push('-');
      } else {
        result.push(ch);
      }
      // prevVowelRow stays the same (장음 뒤에 또 장음 가능)
      i++;
      continue;
    }

    // Long vowel: vowel kana extending previous syllable's vowel row
    const extends_ = LONG_VOWEL_EXTENDS[ch];
    if (extends_ && prevVowelRow && extends_.includes(prevVowelRow)) {
      result.push('-');
      // prevVowelRow stays the same
      i++;
      continue;
    }

    // ン → ㄴ 받침 on previous syllable
    if (ch === 'ン') {
      if (result.length > 0) {
        const modified = addBatchim(result[result.length - 1], JONGSEONG_NIEUN);
        if (modified) {
          result[result.length - 1] = modified;
          i++;
          prevVowelRow = null;
          continue;
        }
      }
      result.push('ㄴ');
      i++;
      prevVowelRow = null;
      continue;
    }

    // ッ → ㅅ 받침 on previous syllable (촉음, 외래어표기법)
    if (ch === 'ッ') {
      if (result.length > 0) {
        const modified = addBatchim(result[result.length - 1], JONGSEONG_SIOT);
        if (modified) {
          result[result.length - 1] = modified;
          i++;
          prevVowelRow = null;
          continue;
        }
      }
      result.push(ch);
      i++;
      prevVowelRow = null;
      continue;
    }

    // try 2-char yōon match first
    if (i + 1 < text.length) {
      const pair = ch + text[i + 1];
      if (YOON_MAP[pair]) {
        result.push(YOON_MAP[pair]);
        prevVowelRow = YOON_VOWEL[pair] ?? null;
        i += 2;
        continue;
      }
    }

    // single-char match
    if (KANA_MAP[ch]) {
      result.push(KANA_MAP[ch]);
      prevVowelRow = VOWEL_ROW[ch] ?? null;
    } else {
      result.push(ch);
      prevVowelRow = null;
    }
    i++;
  }
  return result.join('');
}

export function convertReading(text: string, display: ReadingDisplay): string {
  if (display === 'KATAKANA') return text;
  if (display === 'HIRAGANA') return katakanaToHiragana(text);
  return katakanaToKorean(text);
}
