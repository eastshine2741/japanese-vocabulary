import { FlashcardDTO } from '../../types/flashcard';

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
  /** 이 곡 복습을 특정 단어 클릭으로 열었다면 그 단어. 첫 카드로 강제된다. */
  leadWordId?: number | null;
}

export interface StudyCard extends FlashcardDTO {
  source: StudySource;
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
}
