export type WeekDotStatus = 'studied' | 'none' | 'freeze' | 'today';

export interface WeekDot {
  date: string; // yyyy-MM-dd in KST study-date space
  status: WeekDotStatus;
}

export interface HomeStats {
  currentStreak: number;
  freezeCount: number;
  freezeMax: number;
  weekDots: WeekDot[];
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
