import type { WeekDot } from '../../types/studyStats';

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** 'yyyy-MM-dd' 의 요일. 타임존이 날짜를 밀지 않도록 UTC 로 읽는다. */
export function weekdayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAY_KO[new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? '';
}

export interface DaySlot {
  key: string;
  label: string;
  status: WeekDot['status'];
  isToday: boolean;
}

/**
 * 축하 화면의 주간 슬롯. 마지막 칸이 오늘이고, 서버가 'today' 로 보내든 'none' 으로 보내든
 * 오늘 칸은 방금 점화된 것으로 그린다.
 */
export function toDaySlots(weekDots: WeekDot[]): DaySlot[] {
  const last = weekDots.length - 1;
  return weekDots.map((dot, i) => ({
    key: dot.date,
    label: i === last ? '오늘' : weekdayOf(dot.date),
    status: dot.status,
    isToday: i === last,
  }));
}
