import { HeatmapDay } from '../../types/studyStats';

export type DayKind =
  /** 달 시작/끝을 메우는 빈 칸. */
  | 'pad'
  /** 오늘 이후. */
  | 'future'
  /** 지난 날인데 학습 기록 없음. */
  | 'none'
  | 'studied'
  | 'freeze';

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface CalendarCell {
  date: string | null;
  dayNumber: number;
  kind: DayKind;
  /** studied 일 때만 1~4. 그 달의 최대 복습 수 대비 강도 — 과거 달을 더 받아도 색이 바뀌지 않는다. */
  level: HeatLevel;
  /** 그날 복습한 카드 수. */
  reviewCount: number;
  /** 현재 연속 구간(띠)에 속하는 날. */
  inRun: boolean;
  /** 띠의 왼쪽/오른쪽 끝 — 주 경계에서도 끊긴다. */
  runStart: boolean;
  runEnd: boolean;
  isToday: boolean;
}

export interface CalendarMonth {
  key: string;
  /** '10월', 올해가 아니면 '2025년 10월' */
  label: string;
  weeks: CalendarCell[][];
}

/** ST1 오늘 완료 / ST2 오늘 아직 / ST3 어제를 프리즈로 이어감. */
export type StreakMode = 'done' | 'pending' | 'frozen';

const DAY_MS = 86400000;

function parse(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function format(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 월=0 … 일=6. */
function mondayIndex(ms: number): number {
  return (new Date(ms).getUTCDay() + 6) % 7;
}

/** HeatmapSection.computeLevel 과 같은 규칙 — 보이는 기간의 최대 복습 수가 기준. */
export function computeLevel(count: number, max: number): HeatLevel {
  if (count <= 0 || max <= 0) return 0;
  const pct = count / max;
  if (pct >= 1) return 4;
  if (pct >= 0.75) return 3;
  if (pct >= 0.5) return 2;
  return 1;
}

/**
 * 히트맵의 마지막 날 = 오늘(KST 04:00 경계의 학습일). 서버가 오늘까지 조밀하게 채워 보내므로
 * 클라이언트가 타임존을 다시 계산하지 않는다.
 */
export function todayOf(days: HeatmapDay[]): string | null {
  return days.length > 0 ? days[days.length - 1].date : null;
}

/**
 * 오늘(미학습이면 어제)부터 거슬러 올라가며 이어진 날들. 프리즈 날은 띠를 잇기만 하고
 * 연속 일수 N 에는 들어가지 않는다 — N 은 서버가 준 currentStreak 을 그대로 쓴다.
 */
function currentRunDates(byDate: Map<string, HeatmapDay>, todayIso: string): Set<string> {
  const out = new Set<string>();
  const today = byDate.get(todayIso);
  let ms = parse(todayIso);
  if (!today || today.reviewCount === 0) ms -= DAY_MS;
  for (;;) {
    const iso = format(ms);
    const row = byDate.get(iso);
    if (!row || (row.reviewCount === 0 && !row.freezeUsed)) break;
    out.add(iso);
    ms -= DAY_MS;
  }
  return out;
}

export function streakMode(studiedToday: boolean, days: HeatmapDay[]): StreakMode {
  if (studiedToday) return 'done';
  const todayIso = todayOf(days);
  if (!todayIso) return 'pending';
  const yesterday = days.find((d) => d.date === format(parse(todayIso) - DAY_MS));
  return yesterday?.freezeUsed ? 'frozen' : 'pending';
}

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

/** '2026-10-02' -> '10월 2일 (금)' */
export function formatDayLabel(iso: string): string {
  const ms = parse(iso);
  const d = new Date(ms);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY_LABELS[mondayIndex(ms)]})`;
}

const padCell: CalendarCell = {
  date: null,
  dayNumber: 0,
  kind: 'pad',
  level: 0,
  reviewCount: 0,
  inRun: false,
  runStart: false,
  runEnd: false,
  isToday: false,
};

/** days 의 첫 날이 든 달부터 이번 달까지, 오래된 달 -> 이번 달 순. days 가 비면 빈 배열. */
export function buildStreakCalendar(days: HeatmapDay[]): CalendarMonth[] {
  const todayIso = todayOf(days);
  if (!todayIso) return [];

  const byDate = new Map(days.map((d) => [d.date, d]));
  const run = currentRunDates(byDate, todayIso);
  const todayMs = parse(todayIso);
  const today = new Date(todayMs);
  const first = new Date(parse(days[0].date));
  const monthCount =
    (today.getUTCFullYear() - first.getUTCFullYear()) * 12 + today.getUTCMonth() - first.getUTCMonth() + 1;

  const months: CalendarMonth[] = [];
  for (let back = monthCount - 1; back >= 0; back--) {
    months.push(buildMonth(today.getUTCFullYear(), today.getUTCMonth() - back, { byDate, run, todayMs }));
  }
  return months;
}

interface MonthContext {
  byDate: Map<string, HeatmapDay>;
  run: Set<string>;
  todayMs: number;
}

function buildMonth(year: number, month: number, ctx: MonthContext): CalendarMonth {
  const firstMs = Date.UTC(year, month, 1);
  const first = new Date(firstMs);
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth();
  const dayCount = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  let max = 0;
  for (let day = 1; day <= dayCount; day++) {
    const count = ctx.byDate.get(format(Date.UTC(y, m, day)))?.reviewCount ?? 0;
    if (count > max) max = count;
  }

  const cells: CalendarCell[] = [];
  for (let i = mondayIndex(firstMs); i > 0; i--) cells.push(padCell);
  for (let day = 1; day <= dayCount; day++) {
    cells.push(buildCell(Date.UTC(y, m, day), day, max, ctx));
  }
  while (cells.length % 7 !== 0) cells.push(padCell);

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(markRunEdges(cells.slice(i, i + 7)));
  }

  return {
    key: `${y}-${String(m + 1).padStart(2, '0')}`,
    label: y === new Date(ctx.todayMs).getUTCFullYear() ? `${m + 1}월` : `${y}년 ${m + 1}월`,
    weeks,
  };
}

function buildCell(ms: number, dayNumber: number, max: number, { byDate, run, todayMs }: MonthContext): CalendarCell {
  const date = format(ms);
  const row = byDate.get(date);
  let kind: DayKind;
  if (ms > todayMs) kind = 'future';
  else if (row && row.reviewCount > 0) kind = 'studied';
  else if (row?.freezeUsed) kind = 'freeze';
  else kind = 'none';

  return {
    date,
    dayNumber,
    kind,
    level: kind === 'studied' ? computeLevel(row!.reviewCount, max) : 0,
    reviewCount: row?.reviewCount ?? 0,
    inRun: run.has(date),
    runStart: false,
    runEnd: false,
    isToday: ms === todayMs,
  };
}

/** 띠는 한 주 안에서만 이어진다 — 줄이 바뀌거나 달이 바뀌면 양 끝이 둥글어진다. */
function markRunEdges(week: CalendarCell[]): CalendarCell[] {
  return week.map((cell, i) => {
    if (!cell.inRun) return cell;
    return {
      ...cell,
      runStart: i === 0 || !week[i - 1].inRun,
      runEnd: i === week.length - 1 || !week[i + 1].inRun,
    };
  });
}
