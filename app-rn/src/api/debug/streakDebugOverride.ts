import { HeatmapDay, HeatmapResponse, HomeStats, ProfileStats } from '../../types/studyStats';

/**
 * 디버그 패널에서 고르는 오늘의 연속 학습 상황. 서버 응답 중 오늘/어제 칸만 덮어써서
 * 홈 헤더·연속 학습 화면·축하 화면이 같은 상황을 보게 한다. 'off' 면 서버 값 그대로.
 */
export type StreakDebugState = 'off' | 'pending' | 'done' | 'frozen';

let state: StreakDebugState = 'off';

export function getStreakDebugState(): StreakDebugState {
  return __DEV__ ? state : 'off';
}

export function setStreakDebugState(next: StreakDebugState) {
  state = next;
}

/** 오늘을 공부한 것으로 만들 때 히트맵에 넣는 복습 수. */
const FAKE_TODAY_REVIEWS = 20;

/**
 * 'frozen' 은 서버 기록과 무관하게 고정 시나리오다: 그저께·그끄저께 학습, 어제 프리즈, 오늘 아직.
 * 그 앞날은 비워서 연속이 딱 2일로 끊기게 한다.
 */
const FROZEN_STREAK = 2;

/** 오늘 완료 여부가 서버와 달라지면 연속 일수를 하루 맞춰 준다. 프리즈 날은 일수에 들어가지 않는다. */
function adjustStreak(currentStreak: number, studiedToday: boolean, s: StreakDebugState): number {
  if (s === 'frozen') return FROZEN_STREAK;
  if (s === 'done' && !studiedToday) return currentStreak + 1;
  if (s !== 'done' && studiedToday) return Math.max(0, currentStreak - 1);
  return currentStreak;
}

export function applyHomeOverride(home: HomeStats, s: StreakDebugState = getStreakDebugState()): HomeStats {
  if (s === 'off') return home;
  const weekDots = home.weekDots.map((dot, i, all) => {
    const back = all.length - 1 - i;
    if (s === 'frozen') {
      if (back === 1) return { ...dot, status: 'freeze' as const };
      if (back === 2 || back === 3) return { ...dot, status: 'studied' as const };
      if (back >= 4) return { ...dot, status: 'none' as const };
      return dot;
    }
    if (back !== 1) return dot;
    return dot.status === 'freeze' ? { ...dot, status: 'none' as const } : dot;
  });
  return {
    ...home,
    currentStreak: adjustStreak(home.currentStreak, home.studiedToday, s),
    studiedToday: s === 'done',
    weekDots,
  };
}

export function applyProfileOverride(
  profile: ProfileStats,
  studiedToday: boolean,
  s: StreakDebugState = getStreakDebugState(),
): ProfileStats {
  if (s === 'off') return profile;
  const currentStreak = adjustStreak(profile.currentStreak, studiedToday, s);
  return { ...profile, currentStreak, longestStreak: Math.max(profile.longestStreak, currentStreak) };
}

/** 마지막 날 = 오늘, 그 앞날 = 어제. */
export function applyHeatmapOverride(
  heatmap: HeatmapResponse,
  s: StreakDebugState = getStreakDebugState(),
): HeatmapResponse {
  if (s === 'off' || heatmap.days.length === 0) return heatmap;
  const last = heatmap.days.length - 1;
  const days = heatmap.days.map((day, i) => {
    if (s === 'frozen' && i < last - 1) {
      const back = last - i;
      if (back <= 3) return { ...day, reviewCount: Math.max(day.reviewCount, FAKE_TODAY_REVIEWS), freezeUsed: false };
      if (back === 4) return { ...day, reviewCount: 0, freezeUsed: false };
      return day;
    }
    if (i === last) {
      return { ...day, reviewCount: s === 'done' ? Math.max(day.reviewCount, FAKE_TODAY_REVIEWS) : 0 };
    }
    if (i === last - 1) {
      if (s === 'frozen') return { ...day, reviewCount: 0, freezeUsed: true };
      return { ...day, freezeUsed: false };
    }
    return day;
  });
  return { days: withPastRun(days) };
}

/** 지난달 달력도 비어 있지 않게 오늘 기준 26~22일 전(10/4 기준 9/8~9/12)에 학습 기록을 넣는다. */
const PAST_RUN = [
  { back: 26, reviewCount: 6 },
  { back: 25, reviewCount: 14 },
  { back: 24, reviewCount: 25 },
  { back: 23, reviewCount: 38 },
  { back: 22, reviewCount: 50 },
];

function withPastRun(days: HeatmapDay[]): HeatmapDay[] {
  const today = days[days.length - 1].date;
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const { back, reviewCount } of PAST_RUN) {
    const date = shiftDate(today, -back);
    byDate.set(date, { date, reviewCount, freezeUsed: false });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function shiftDate(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
