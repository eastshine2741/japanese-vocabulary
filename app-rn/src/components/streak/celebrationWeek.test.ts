import { describe, expect, it } from 'vitest';
import { toDaySlots, weekdayOf } from './celebrationWeek';

describe('weekdayOf', () => {
  it('타임존과 무관하게 날짜 문자열 그대로의 요일을 준다', () => {
    expect(weekdayOf('2026-10-04')).toBe('일');
    expect(weekdayOf('2026-10-05')).toBe('월');
    expect(weekdayOf('2026-01-01')).toBe('목');
  });
});

describe('toDaySlots', () => {
  const week = [
    { date: '2026-09-28', status: 'none' as const },
    { date: '2026-09-29', status: 'studied' as const },
    { date: '2026-09-30', status: 'freeze' as const },
    { date: '2026-10-04', status: 'today' as const },
  ];

  it('마지막 칸만 오늘로 보고 나머지는 요일을 붙인다', () => {
    const slots = toDaySlots(week);
    expect(slots.map(s => s.label)).toEqual(['월', '화', '수', '오늘']);
    expect(slots.map(s => s.isToday)).toEqual([false, false, false, true]);
  });

  it('상태는 그대로 넘긴다', () => {
    expect(toDaySlots(week).map(s => s.status)).toEqual(['none', 'studied', 'freeze', 'today']);
  });

  it('빈 배열이면 슬롯도 없다', () => {
    expect(toDaySlots([])).toEqual([]);
  });
});
