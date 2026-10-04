/** 오늘 목록에 들어간 단어 미리보기 칩. */
export interface SchedulePreviewWord {
  wordId: number;
  japanese: string;
}

/** 그 학습일이 시작하는 순간 기억하고 있을 단어 수의 기대값 (카드별 FSRS 기억 확률의 합). */
export interface MemoryForecastDay {
  /** yyyy-MM-dd (KST 학습일 경계). */
  date: string;
  /** 매일 그날 due 를 전부 '알고 있음'으로 복습했을 때. */
  rememberedIfReviewed: number;
  /** 오늘부터 복습하지 않을 때. */
  rememberedIfSkipped: number;
}

export interface StudyScheduleResponse {
  /** 지금 due 인 카드 수. */
  dueToday: number;
  /** 오늘 복습을 끝내도 내일 새로 due 가 되는 카드 수. */
  dueTomorrow: number;
  /** 보유한 전체 카드 수. */
  totalCards: number;
  /** 오늘 목록 앞쪽 단어 (최대 3개). */
  previewWords: SchedulePreviewWord[];
  /** 오늘부터 365일. */
  days: MemoryForecastDay[];
}
