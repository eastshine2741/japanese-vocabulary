import { describe, expect, it } from 'vitest';
import { HeatmapDay } from '../../types/studyStats';
import { buildStreakCalendar, computeLevel, formatDayLabel, streakMode } from './streakCalendar';

const DAY_MS = 86400000;

function iso(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** endIso 에서 끝나는 n 일치 히트맵. counts/freezes 는 끝에서부터 덮어쓴다. */
function days(endIso: string, n: number, overrides: Record<string, Partial<HeatmapDay>> = {}): HeatmapDay[] {
  const [y, m, d] = endIso.split('-').map(Number);
  const end = Date.UTC(y, m - 1, d);
  return Array.from({ length: n }, (_, i) => {
    const date = iso(end - (n - 1 - i) * DAY_MS);
    return { date, reviewCount: 0, freezeUsed: false, ...overrides[date] };
  });
}

function cellOf(months: ReturnType<typeof buildStreakCalendar>, date: string) {
  for (const month of months) {
    for (const week of month.weeks) {
      const found = week.find((c) => c.date === date);
      if (found) return found;
    }
  }
  return null;
}

describe('computeLevel', () => {
  it('보이는 기간의 최대 복습 수를 기준으로 4단계를 나눈다', () => {
    expect(computeLevel(0, 20)).toBe(0);
    expect(computeLevel(1, 20)).toBe(1);
    expect(computeLevel(10, 20)).toBe(2);
    expect(computeLevel(15, 20)).toBe(3);
    expect(computeLevel(20, 20)).toBe(4);
  });
});

describe('streakMode', () => {
  it('오늘 학습했으면 done', () => {
    expect(streakMode(true, days('2026-10-04', 10))).toBe('done');
  });

  it('오늘 아직이고 어제도 평범하면 pending', () => {
    expect(streakMode(false, days('2026-10-04', 10, { '2026-10-03': { reviewCount: 5 } }))).toBe('pending');
  });

  it('오늘 아직인데 어제가 프리즈면 frozen', () => {
    expect(streakMode(false, days('2026-10-04', 10, { '2026-10-03': { freezeUsed: true } }))).toBe('frozen');
  });

  it('데이터가 없으면 pending', () => {
    expect(streakMode(false, [])).toBe('pending');
  });
});

describe('buildStreakCalendar', () => {
  it('지난 달과 이번 달 두 장을 월요일 시작으로 만든다', () => {
    const months = buildStreakCalendar(days('2026-10-04', 112));
    expect(months.map((m) => m.key)).toEqual(['2026-09', '2026-10']);
    expect(months[1].label).toBe('10월');
    // 2026-10-01 은 목요일 -> 앞에 월·화·수 세 칸이 비어 있다.
    expect(months[1].weeks[0].slice(0, 3).map((c) => c.kind)).toEqual(['pad', 'pad', 'pad']);
    expect(months[1].weeks[0][3].date).toBe('2026-10-01');
  });

  it('칸 상태를 미래/미학습/학습/프리즈로 가른다', () => {
    const months = buildStreakCalendar(
      days('2026-10-04', 112, {
        '2026-10-02': { reviewCount: 4 },
        '2026-10-03': { freezeUsed: true },
      }),
    );
    expect(cellOf(months, '2026-10-01')!.kind).toBe('none');
    expect(cellOf(months, '2026-10-02')!.kind).toBe('studied');
    expect(cellOf(months, '2026-10-03')!.kind).toBe('freeze');
    expect(cellOf(months, '2026-10-05')!.kind).toBe('future');
    expect(cellOf(months, '2026-10-04')!.isToday).toBe(true);
  });

  it('오늘까지 이어진 구간에 띠를 깔고 양 끝을 둥글게 표시한다', () => {
    const months = buildStreakCalendar(
      days('2026-10-04', 112, {
        '2026-10-01': { reviewCount: 2 },
        '2026-10-02': { reviewCount: 3 },
        '2026-10-03': { reviewCount: 1 },
        '2026-10-04': { reviewCount: 2 },
      }),
    );
    expect(cellOf(months, '2026-09-30')!.inRun).toBe(false);
    expect(cellOf(months, '2026-10-01')!.runStart).toBe(true);
    expect(cellOf(months, '2026-10-02')!.inRun).toBe(true);
    expect(cellOf(months, '2026-10-04')!.runEnd).toBe(true);
  });

  it('오늘이 아직이면 띠는 어제에서 끝난다', () => {
    const months = buildStreakCalendar(
      days('2026-10-04', 112, {
        '2026-10-02': { reviewCount: 3 },
        '2026-10-03': { reviewCount: 1 },
      }),
    );
    expect(cellOf(months, '2026-10-03')!.runEnd).toBe(true);
    expect(cellOf(months, '2026-10-04')!.inRun).toBe(false);
  });

  it('프리즈 날도 띠를 잇는다', () => {
    const months = buildStreakCalendar(
      days('2026-10-04', 112, {
        '2026-10-01': { reviewCount: 2 },
        '2026-10-02': { reviewCount: 3 },
        '2026-10-03': { freezeUsed: true },
      }),
    );
    expect(cellOf(months, '2026-10-01')!.inRun).toBe(true);
    expect(cellOf(months, '2026-10-03')!.inRun).toBe(true);
    expect(cellOf(months, '2026-10-03')!.runEnd).toBe(true);
  });

  it('달이 바뀌면 띠도 끊겨 각각 양 끝이 둥글다', () => {
    const months = buildStreakCalendar(
      days('2026-10-04', 112, {
        '2026-09-29': { reviewCount: 1 },
        '2026-09-30': { reviewCount: 1 },
        '2026-10-01': { reviewCount: 1 },
        '2026-10-02': { reviewCount: 1 },
        '2026-10-03': { reviewCount: 1 },
        '2026-10-04': { reviewCount: 1 },
      }),
    );
    expect(cellOf(months, '2026-09-29')!.runStart).toBe(true);
    expect(cellOf(months, '2026-09-30')!.runEnd).toBe(true);
    expect(cellOf(months, '2026-10-01')!.runStart).toBe(true);
  });

  it('주가 바뀌어도 띠가 끊긴다', () => {
    const months = buildStreakCalendar(
      days('2026-10-06', 112, {
        '2026-10-04': { reviewCount: 1 },
        '2026-10-05': { reviewCount: 1 },
        '2026-10-06': { reviewCount: 1 },
      }),
    );
    // 10/4 는 일요일(주의 끝), 10/5 는 월요일(다음 주의 시작)
    expect(cellOf(months, '2026-10-04')!.runEnd).toBe(true);
    expect(cellOf(months, '2026-10-05')!.runStart).toBe(true);
  });

  it('히트맵이 비면 달력도 비운다', () => {
    expect(buildStreakCalendar([])).toEqual([]);
  });
});

describe('formatDayLabel', () => {
  it('월/일과 요일을 붙인다', () => {
    expect(formatDayLabel('2026-10-02')).toBe('10월 2일 (금)');
    expect(formatDayLabel('2026-10-04')).toBe('10월 4일 (일)');
  });
});
