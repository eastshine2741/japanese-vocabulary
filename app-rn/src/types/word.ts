/**
 * 예문. songId + lineIndex 가 모두 있으면 해당 곡의 그 가사 줄로 이동할 수 있다.
 * songTitle / artworkUrl 은 서버가 응답에만 채워주는 읽기 전용 메타데이터다.
 */
export interface SenseExample {
  text: string;
  translation: string | null;
  songId: number | null;
  lineIndex: number | null;
  songTitle?: string | null;
  artworkUrl?: string | null;
}

/** 단어의 뜻 하나. 품사·JLPT·예문을 각자 소유한다. */
export interface WordSense {
  meaning: string;
  partOfSpeech: string;
  jlpt?: string | null;
  examples?: SenseExample[];
}

export interface WordDetailResponse {
  id: number;
  japanese: string;
  reading: string | null;
  senses: WordSense[];
}

export interface WordListItem {
  id: number;
  japanese: string;
  reading: string;
  senses: WordSense[];
}

export interface WordListResponse {
  words: WordListItem[];
  nextCursor: number | null;
}

export interface AddWordRequest {
  japanese: string;
  reading?: string | null;
  senses: WordSense[];
  /** 담은 화면의 곡. 값이 있으면 곡 단어장에도 담긴다. */
  songId?: number | null;
}

export interface BatchAddWordRequest {
  words: AddWordRequest[];
}

export interface BatchAddWordResponse {
  savedCount: number;
  skippedCount: number;
}

/** senses 는 전체 replace 다 — 서버는 보낸 배열로 통째 덮어쓴다. */
export interface UpdateWordRequest {
  reading: string | null;
  senses: WordSense[];
  resetFlashcard?: boolean;
}

const MEANING_SEPARATORS = new Set([',', '，', '、']);
const MEANING_OPEN_BRACKETS = new Set(['(', '（', '[', '［']);
const MEANING_CLOSE_BRACKETS = new Set([')', '）', ']', '］']);

/**
 * 곡 분석이 주는 뜻은 "사랑, 애정" 처럼 쉼표로 이어진 문자열 하나다. 단어는 뜻 단위이므로 조각마다
 * 별개의 sense 로 쪼갠다 — 서버의 `splitMeaningText` 와 같은 규칙이다.
 * 괄호 안 쉼표는 자르지 않는다: "(사람, 물건이) 있다" 가 반토막 나면 안 된다.
 */
export function splitMeaningText(meaning: string | null | undefined): string[] {
  if (!meaning) return [];
  const parts: string[] = [];
  let buffer = '';
  let depth = 0;
  for (const ch of meaning) {
    if (MEANING_OPEN_BRACKETS.has(ch)) {
      depth++;
      buffer += ch;
    } else if (MEANING_CLOSE_BRACKETS.has(ch)) {
      if (depth > 0) depth--;
      buffer += ch;
    } else if (MEANING_SEPARATORS.has(ch) && depth === 0) {
      parts.push(buffer);
      buffer = '';
    } else {
      buffer += ch;
    }
  }
  parts.push(buffer);
  return [...new Set(parts.map(p => p.trim()).filter(p => p !== ''))];
}

/** 여러 뜻을 한 줄로 요약할 때 쓰는 공통 헬퍼. */
export function joinMeanings(senses: WordSense[] | undefined): string {
  return (senses ?? []).map(s => s.meaning).filter(Boolean).join(', ');
}

/** 뜻에 흩어져 있는 예문을 화면 표시 순서대로 펼친다. */
export function flattenExamples(senses: WordSense[] | undefined): SenseExample[] {
  return (senses ?? []).flatMap(s => s.examples ?? []);
}
