import { FlashcardDTO, FlashcardMemory } from '../../types/flashcard';
import { SongWordTierKey } from '../../types/song';
import { WordSense } from '../../types/word';

export type StudyStackStatus = 'loading' | 'ready' | 'error';

/** 스택 한 세션의 출처가 되는 곡. deckId 가 null 이면 아직 이 곡의 덱이 없다. */
export interface StudySource {
  deckId: number | null;
  songId: number | null;
  title: string;
  artist: string;
  artworkUrl: string | null;
  dueCount: number;
  totalCount: number;
  /** 이미 담긴 단어 클릭으로 열었다면 그 단어. 곡 덱 첫 카드로 강제되고, 곡 덱에 없으면 그 실제 카드를 미리보기로 띄운다. */
  leadWordId?: number | null;
  /** 곡 상세에서 단어를 눌러 열었다면 그 단어. 곡 덱 첫 카드로 못 세우면 이 단어를 맨 앞에 둔 곡 세션 카드(`study-cards`)를 연다. */
  previewWord?: StudyPreviewWord | null;
  /** 곡 상세의 단계 학습으로 열었다면 그 단계. 곡 덱 due 큐 대신 그 단계의 due 단어를 한 번 받아 복습한다. */
  tierKey?: SongWordTierKey | null;
  /** 소절 학습으로 열었다면 그 줄의 단어 키. 세 단계의 due 카드 중 이 단어만 한 번 복습한다. */
  lineWords?: readonly string[] | null;
}

/**
 * 이번 세션에서 단어가 옮겨간 기억 칸. 리뷰 전후 칸이 실제로 바뀐 카드만 센다 — 이미 장기기억이던
 * 단어를 다시 복습해도 "장기기억으로" 에는 잡히지 않는다.
 */
export interface StudyMemoryDiff {
  /** 장기기억이 아니었다가 장기기억이 된 단어 수 */
  toLongTerm: number;
  /** 단기기억이 아니었다가 단기기억이 된 단어 수 — 처음 배운 단어와 장기기억에서 잊은 단어 */
  toShortTerm: number;
}

export const EMPTY_MEMORY_DIFF: StudyMemoryDiff = { toLongTerm: 0, toShortTerm: 0 };

/** 리뷰 전후 기억 칸으로 이동 한 건을 누적한다. 칸이 그대로면 아무것도 세지 않는다. */
export function accumulateMemoryDiff(
  diff: StudyMemoryDiff,
  before: FlashcardMemory,
  after: FlashcardMemory,
): StudyMemoryDiff {
  if (before === after) return diff;
  if (after === 'LONG_TERM') return { ...diff, toLongTerm: diff.toLongTerm + 1 };
  if (after === 'SHORT_TERM') return { ...diff, toShortTerm: diff.toShortTerm + 1 };
  return diff;
}

export interface StudyPreviewWord {
  japanese: string;
  reading: string | null;
  senses: WordSense[];
}

export interface StudyCard extends FlashcardDTO {
  source: StudySource;
  /** 아직 곡 단어장에 없는 카드. rating 때 그 단어 하나만 곡 단어장에 담으면서 리뷰한다. */
  saveOnReview?: boolean;
}

/** 아직 담지 않은 단어의 카드는 flashcard 가 없어 세션 안에서만 쓰는 음수 id 를 받는다. */
export function isUnsavedCard(card: FlashcardDTO): boolean {
  return card.id < 0;
}

/** 크롬이 그리는 세션 진행 정보. 공용 스택은 이 값만 노출하고 크롬은 그리지 않는다. */
export interface StudySessionProgress {
  /** 이번 세션에서 저장까지 끝난 카드 수 (같은 카드를 다시 봐도 매번 센다) */
  reviewedCount: number;
  /** n: 이번 세션에서 리뷰를 마친 distinct 카드 수. 페이지네이션으로 같은 카드를 다시 봐도 한 번만 센다. */
  position: number;
  /** m: 이번 세션 시작 시점에 due였던 카드 수. 세션 도중엔 바뀌지 않는다. */
  queueTotal: number;
  /** 곡 단어장 대비 진행률 0~1 (홈 세션 바) */
  progress: number;
  /** 큐 대비 진행률 0~1 (스택 카운터 바) */
  queueProgress: number;
  /** 이 유저의 카드당 예상 초. 곡이 바뀌어도 이어서 잰다. */
  secondsPerCard: number;
}
