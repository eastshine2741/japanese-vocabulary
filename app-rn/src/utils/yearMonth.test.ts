import { describe, expect, it } from 'vitest';
import { currentYearMonth, formatMonthDay, formatWeekday, formatYearMonth, shiftYearMonth } from './yearMonth';

describe('yearMonth', () => {
  it('현재 달을 YYYY-MM 으로 만든다', () => {
    expect(currentYearMonth(new Date(2026, 9, 5))).toBe('2026-10');
    expect(currentYearMonth(new Date(2026, 0, 31))).toBe('2026-01');
  });

  it('달을 넘길 때 연도가 따라간다', () => {
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftYearMonth('2026-10', -3)).toBe('2026-07');
  });

  it('사람이 읽는 표기로 바꾼다', () => {
    expect(formatYearMonth('2026-10')).toBe('2026년 10월');
    expect(formatMonthDay('2026-10-03')).toBe('10월 3일');
    expect(formatWeekday('2026-10-03')).toBe('(토)');
  });
});
