export type WeekDotStatus = 'studied' | 'none' | 'freeze' | 'today';

export interface WeekDot {
  date: string; // yyyy-MM-dd in KST study-date space
  status: WeekDotStatus;
}

export interface HomeStats {
  /** 오늘 학습했으면 오늘 포함, 아니면 어제까지 이어진 일수(끊겼으면 0). */
  currentStreak: number;
  freezeCount: number;
  freezeMax: number;
  weekDots: WeekDot[];
  /** 오늘(KST 04:00 경계) 리뷰 기록이 있는지. freeze 로만 채워진 날은 false. */
  studiedToday: boolean;
  /** 오늘 이전에 하루라도 학습한 적 있는지 — 첫날과 끊긴 뒤 재시작을 가른다. */
  hasStudiedBefore: boolean;
}

export interface WeeklyChartDay {
  date: string;
  reviewCount: number;
  freezeUsed: boolean;
  isToday: boolean;
}

export interface ProfileStats {
  currentStreak: number;
  longestStreak: number;
  totalStudyDays: number;
  freezeCount: number;
  freezeMax: number;
  dailyGoal: number;
}

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatmapDay {
  date: string;
  reviewCount: number;
  freezeUsed: boolean;
}

export interface HeatmapResponse {
  days: HeatmapDay[];
}
