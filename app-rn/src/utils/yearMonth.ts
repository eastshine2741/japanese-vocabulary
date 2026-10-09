const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** YYYY-MM */
export function currentYearMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  return currentYearMonth(shifted);
}

export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return `${year}년 ${month}월`;
}

/** YYYY-MM-DD -> "10월 3일" */
export function formatMonthDay(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number);
  return `${month}월 ${day}일`;
}

/** YYYY-MM-DD -> "(토)". 서버 날짜에 시간대가 없어 로컬 자정으로 읽는다. */
export function formatWeekday(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `(${WEEKDAYS[new Date(year, month - 1, day).getDay()]})`;
}
