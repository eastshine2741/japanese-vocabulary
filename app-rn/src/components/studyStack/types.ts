import { FlashcardDTO } from '../../types/flashcard';

/** 카드 스택이 어디서 왔는지 — due 덱, 추천곡(mock), 다음 due 덱(mock). */
export type StudyCardOrigin = 'due' | 'recommended' | 'mockDue';

export type StudyStackStatus = 'loading' | 'ready' | 'error';

/** 스택 한 세션의 출처가 되는 곡. deckId 가 null 이면 실제 덱이 아니다(mock). */
export interface StudySource {
  deckId: number | null;
  songId: number | null;
  title: string;
  artist: string;
  artworkUrl: string | null;
  dueCount: number;
  totalCount: number;
}

export interface StudyCard extends FlashcardDTO {
  source: StudySource;
  origin: StudyCardOrigin;
}

/** 크롬이 그리는 세션 진행 정보. 공용 스택은 이 값만 노출하고 크롬은 그리지 않는다. */
export interface StudySessionProgress {
  /** 이번 세션에서 저장까지 끝난 카드 수 */
  reviewedCount: number;
  /** 현재 카드의 1-based 번호. 큐가 끝나면 queueTotal 과 같다. */
  position: number;
  /** 이번 세션 큐의 전체 카드 수 */
  queueTotal: number;
  /** 곡 단어장 대비 진행률 0~1 (홈 세션 바) */
  progress: number;
  /** 큐 대비 진행률 0~1 (스택 카운터 바) */
  queueProgress: number;
}
