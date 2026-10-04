import { create } from 'zustand';
import { studyStatsApi } from '../api/studyStatsApi';
import { HomeStats, WeekDot } from '../types/studyStats';

export interface StreakCelebrationCopy {
  /** 큰 글자 — 감탄. */
  headline: string;
  /** 아랫줄 — 격려. */
  sub: string;
}

export interface StreakCelebrationContent extends StreakCelebrationCopy {
  /** 오늘 포함 연속 일수. */
  streak: number;
  /** 오늘 포함 지난 7일. 마지막 칸이 오늘이고 축하 화면에서 점화된다. */
  weekDots: WeekDot[];
}

type HomeStatsInput = Pick<HomeStats, 'currentStreak' | 'studiedToday' | 'hasStudiedBefore'> &
  Partial<Pick<HomeStats, 'weekDots'>>;

interface StreakState {
  /** 홈 통계를 한 번이라도 받았는지. 모르면 넛지도 축하 화면도 내지 않는다. */
  loaded: boolean;
  /** 오늘 학습했으면 오늘 포함, 아니면 어제까지의 연속 일수(끊겼으면 0) — 헤더 칩 숫자. */
  currentStreak: number;
  studiedToday: boolean;
  hasStudiedBefore: boolean;
  /** 오늘 포함 지난 7일. 마지막 칸이 오늘. */
  weekDots: WeekDot[];
  /** 오늘 첫 rating 직후 한 번 채워지고, 축하 화면을 닫으면 비운다. */
  celebration: StreakCelebrationContent | null;

  applyHomeStats: (stats: HomeStatsInput) => void;
  /** 홈을 거치지 않고 복습에 들어온 화면용 — 아직 홈 통계가 없으면 한 번 받아온다. 실패는 조용히 무시. */
  ensureLoaded: () => Promise<void>;
  /** rating 이 서버에 기록된 직후 호출. 오늘 첫 rating 이면 숫자를 올리고 축하 화면을 띄운다. */
  recordRating: () => void;
  /** 디버그용 — 실제 학습 기록과 무관하게 축하 화면만 띄운다. */
  showCelebration: (celebration: StreakCelebrationContent) => void;
  dismissCelebration: () => void;
  reset: () => void;
}

/** 문구표. N = 오늘 포함 연속 일수. freeze 로 이어진 경우도 이어감과 같다. */
export function streakCelebrationCopy(streakToday: number, hasStudiedBefore: boolean): StreakCelebrationCopy {
  if (streakToday >= 2) {
    return { headline: '불꽃이 점점 커지고 있어요!', sub: '오늘도 해냈어요. 내일 이 자리에서 또 만나요' };
  }
  if (hasStudiedBefore) {
    return { headline: '불꽃을 다시 켰어요!', sub: '내일 한 번만 더 오면 2일 연속이에요' };
  }
  return { headline: '첫 불꽃을 켰어요!', sub: '내일 한 번만 더 오면 2일 연속이에요' };
}

const initial = {
  loaded: false,
  currentStreak: 0,
  studiedToday: false,
  hasStudiedBefore: false,
  weekDots: [] as WeekDot[],
  celebration: null,
};

export const useStreakStore = create<StreakState>((set, get) => ({
  ...initial,

  applyHomeStats: ({ currentStreak, studiedToday, hasStudiedBefore, weekDots }) =>
    set({ loaded: true, currentStreak, studiedToday, hasStudiedBefore, weekDots: weekDots ?? [] }),

  ensureLoaded: async () => {
    if (get().loaded) return;
    try {
      get().applyHomeStats(await studyStatsApi.getHome());
    } catch {
      // 통계가 없으면 축하 화면을 안 띄울 뿐, 복습 자체는 막지 않는다.
    }
  },

  // 홈 통계를 다시 받기 전까지는 studiedToday 가 true 로 남는다 — 하루 경계(04:00)를 넘겨도
  // 한 세션에서는 축하 화면을 한 번만 보이고, 다음 홈 진입 때 새 날짜 기준으로 갱신된다.
  recordRating: () => {
    const { loaded, studiedToday, currentStreak, hasStudiedBefore, weekDots } = get();
    if (!loaded || studiedToday) return;
    const streakToday = currentStreak + 1;
    set({
      studiedToday: true,
      currentStreak: streakToday,
      celebration: { ...streakCelebrationCopy(streakToday, hasStudiedBefore), streak: streakToday, weekDots },
    });
  },

  showCelebration: (celebration) => set({ celebration }),

  dismissCelebration: () => set({ celebration: null }),

  reset: () => set(initial),
}));
