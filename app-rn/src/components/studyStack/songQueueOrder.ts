import { FlashcardDTO } from '../../types/flashcard';

/**
 * 곡 진입 복습 큐 정렬 — 탭한 단어가 1번, 나머지는 곡 등장순.
 *
 * 서버 due 응답은 셔플된 순서라 클라이언트에서 다시 세운다. 정식 계약이
 * (GET /api/study/session?startWordId=) 생기면 이 모듈만 걷어내면 된다.
 */

/** 곡 단어 목록에서 정렬에 필요한 최소 형태. */
export interface SongWordOrderSource {
  japanese: string;
  appearanceOrder: number;
  addRequest: { japanese: string };
}

/**
 * japanese text -> 곡 등장 순서.
 * words 는 UNIQUE(user_id, japanese_text) 라 저장된 카드와 텍스트로 맞출 수 있다.
 * 저장 키는 addRequest.japanese 가 우선이고, 표시용 japanese 도 같이 등록한다.
 */
export function buildSongWordOrder(words: readonly SongWordOrderSource[]): Map<string, number> {
  const order = new Map<string, number>();
  const register = (key: string | null | undefined, appearanceOrder: number) => {
    if (!key) return;
    const previous = order.get(key);
    if (previous == null || appearanceOrder < previous) {
      order.set(key, appearanceOrder);
    }
  };
  for (const word of words) {
    register(word.addRequest?.japanese, word.appearanceOrder);
    register(word.japanese, word.appearanceOrder);
  }
  return order;
}

/**
 * useStudyStack 의 orderCards 어댑터를 만든다.
 * 곡 단어 목록이 없으면 undefined 를 돌려주고 서버 순서를 그대로 쓴다.
 */
export function createSongQueueOrderer(
  words: readonly SongWordOrderSource[] | null | undefined,
  focusJapanese: string | null | undefined,
): ((cards: FlashcardDTO[]) => FlashcardDTO[]) | undefined {
  if (!words || words.length === 0) return undefined;
  const order = buildSongWordOrder(words);
  if (order.size === 0) return undefined;
  // focus 단어가 이 곡의 단어일 때만 1번으로 올린다 — 다른 곡 큐에 잘못 걸리지 않게.
  const focusKey = focusJapanese && order.has(focusJapanese) ? focusJapanese : null;

  return (cards: FlashcardDTO[]) => {
    return cards
      .map((card, index) => ({
        card,
        index,
        rank: focusKey != null && card.japanese === focusKey
          ? -1
          : order.get(card.japanese) ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
      .map(entry => entry.card);
  };
}
