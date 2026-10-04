import { HeatmapResponse, HomeStats, ProfileStats } from '../../types/studyStats';

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

/** 오늘 완료 여부가 서버와 달라지면 연속 일수를 하루 맞춰 준다. 프리즈 날은 일수에 들어가지 않는다. */
function adjustStreak(currentStreak: number, studiedToday: boolean, s: StreakDebugState): number {
  if (s === 'done' && !studiedToday) return currentStreak + 1;
  if (s !== 'done' && studiedToday) return Math.max(0, currentStreak - 1);
  return currentStreak;
}

export function applyHomeOverride(home: HomeStats, s: StreakDebugState = getStreakDebugState()): HomeStats {
  if (s === 'off') return home;
  const weekDots = home.weekDots.map((dot, i, all) => {
    if (i !== all.length - 2) return dot;
    if (s === 'frozen') return { ...dot, status: 'freeze' as const };
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
    if (i === last) {
      return { ...day, reviewCount: s === 'done' ? Math.max(day.reviewCount, FAKE_TODAY_REVIEWS) : 0 };
    }
    if (i === last - 1) {
      if (s === 'frozen') return { ...day, reviewCount: 0, freezeUsed: true };
      return { ...day, freezeUsed: false };
    }
    return day;
  });
  return { days };
}
