/** 오늘 목록에 들어간 단어 미리보기 칩. */
export interface SchedulePreviewWord {
  wordId: number;
  japanese: string;
}

export interface ScheduleForecastDay {
  /** yyyy-MM-dd (KST 학습일 경계). */
  date: string;
  /** 아무것도 복습하지 않을 때 그날 due 가 되는 카드 수. 0일차는 이미 밀린 것까지 포함한다. */
  scheduledDue: number;
  /** dailyTarget 장씩 '알고 있음'으로만 평가했을 때 그날 실제로 복습하는 카드 수. */
  simulatedReview: number;
}

export interface StudyScheduleResponse {
  /** 지금 due 인 카드 수. */
  dueToday: number;
  /** 보유한 전체 카드 수. */
  totalCards: number;
  /** 오늘 목록 앞쪽 단어 (최대 3개). */
  previewWords: SchedulePreviewWord[];
  /** 이 응답이 시뮬레이션에 쓴 하루 목표 장수. */
  dailyTarget: number;
  /** 오늘부터 30일. */
  days: ScheduleForecastDay[];
}
