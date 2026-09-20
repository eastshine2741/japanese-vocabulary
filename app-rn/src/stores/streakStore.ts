import { create } from 'zustand';
import { HomeStats } from '../types/studyStats';

export interface StreakToastContent {
  /** 윗줄(작은 글자) — 연속 학습 상태. */
  eyebrow: string;
  /** 아랫줄(큰 글자) — 그 상태에 붙이는 한마디. */
  label: string;
}

interface StreakState {
  /** 홈 통계를 한 번이라도 받았는지. 모르면 넛지도 토스트도 내지 않는다. */
  loaded: boolean;
  /** 오늘 학습했으면 오늘 포함, 아니면 어제까지의 연속 일수(끊겼으면 0) — 헤더 칩 숫자. */
  currentStreak: number;
  studiedToday: boolean;
  hasStudiedBefore: boolean;
  /** 오늘 첫 rating 직후 한 번 채워지고, 배너가 스스로 사라지면 비운다. */
  toast: StreakToastContent | null;

  applyHomeStats: (stats: Pick<HomeStats, 'currentStreak' | 'studiedToday' | 'hasStudiedBefore'>) => void;
  /** rating 이 서버에 기록된 직후 호출. 오늘 첫 rating 이면 숫자를 올리고 배너를 띄운다. */
  recordRating: () => void;
  dismissToast: () => void;
  reset: () => void;
}

/** A-2 문구표. N = 오늘 포함 연속 일수. freeze 로 이어진 경우도 이어감과 같다. */
export function streakToastContent(streakToday: number, hasStudiedBefore: boolean): StreakToastContent {
  if (streakToday >= 2) {
    return { eyebrow: `연속 학습 ${streakToday}일째`, label: `${streakToday}일째 이어가고 있어요!` };
  }
  if (hasStudiedBefore) {
    return { eyebrow: '연속 학습 다시 시작', label: '돌아오신 걸 환영해요!' };
  }
  return { eyebrow: '연속 학습 시작', label: '오늘부터 함께 힘내요!' };
}

const initial = {
  loaded: false,
  currentStreak: 0,
  studiedToday: false,
  hasStudiedBefore: false,
  toast: null,
};

export const useStreakStore = create<StreakState>((set, get) => ({
  ...initial,

  applyHomeStats: ({ currentStreak, studiedToday, hasStudiedBefore }) =>
    set({ loaded: true, currentStreak, studiedToday, hasStudiedBefore }),

  // 홈 통계를 다시 받기 전까지는 studiedToday 가 true 로 남는다 — 하루 경계(04:00)를 넘겨도
  // 한 세션에서는 배너를 한 번만 보이고, 다음 홈 진입 때 새 날짜 기준으로 갱신된다.
  recordRating: () => {
    const { loaded, studiedToday, currentStreak, hasStudiedBefore } = get();
    if (!loaded || studiedToday) return;
    const streakToday = currentStreak + 1;
    set({
      studiedToday: true,
      currentStreak: streakToday,
      toast: streakToastContent(streakToday, hasStudiedBefore),
    });
  },

  dismissToast: () => set({ toast: null }),

  reset: () => set(initial),
}));
