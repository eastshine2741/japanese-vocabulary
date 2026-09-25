import { WordSense } from './word';

/**
 * 카드 하나의 기억 칸. 서버 `FlashcardMemory` 와 1:1 — 판정 기준(장기기억 = stability >= 7일)은
 * 서버에만 있고 앱은 결과만 받는다. 곡 상세 이해도와 완주 카드의 기억 이동이 같은 기준을 쓴다.
 */
export type FlashcardMemory = 'LONG_TERM' | 'SHORT_TERM' | 'REMAINING';

export interface FlashcardDTO {
  id: number;
  wordId: number;
  japanese: string;
  reading: string | null;
  senses: WordSense[];
  /** FSRS `State.ordinal` — 0 LEARNING, 1 REVIEW, 2 RELEARNING. 기억 칸 판정에는 `memory` 를 쓴다. */
  state: number;
  due: string;
  intervals: Record<number, string> | null; // rating -> interval string
  /** 아직 이 카드를 리뷰하기 전의 기억 칸. 리뷰 후 `ReviewResponse.memory` 와 비교해 이동을 센다. */
  memory: FlashcardMemory;
}

export interface DueFlashcardsResponse {
  cards: FlashcardDTO[];
  totalCount: number;
  nextDueAt: string | null;
}

export interface FlashcardStatsResponse {
  total: number;
  due: number;
  newCount: number;
  /** 구버전 앱용 FSRS state 기준 값. 진행 바는 longTermCount/shortTermCount 를 쓴다. */
  learning: number;
  review: number;
  /** 장기기억 — 7일 뒤 90% 이상 회상. */
  longTermCount: number;
  /** 단기기억 — 리뷰 이력이 있으나 장기기억이 아닌 카드. */
  shortTermCount: number;
}

export interface ReviewRequest {
  rating: number;
}

export interface ReviewResponse {
  id: number;
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  /** 이 리뷰를 반영한 뒤의 기억 칸. */
  memory: FlashcardMemory;
}

export interface UserSettingsDTO {
  showIntervals: boolean;
  readingDisplay: 'KATAKANA' | 'HIRAGANA' | 'KOREAN';
  showKoreanPronunciation: boolean;
  showFurigana: boolean;
  dailyGoal: number;
  notificationsEnabled: boolean;
}
