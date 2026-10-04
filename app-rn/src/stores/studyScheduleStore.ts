import { create } from 'zustand';
import { studyScheduleApi } from '../api/studyScheduleApi';
import { DEFAULT_DAILY_TARGET } from '../components/studySchedule/scheduleMath';
import { StudyScheduleResponse } from '../types/studySchedule';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface StudyScheduleState {
  status: Status;
  data: StudyScheduleResponse | null;
  error: string | null;
  /** 시뮬레이션에 쓰는 하루 목표 장수. 설정의 `dailyGoal` 과는 별개로, 저장되지 않는다. */
  dailyTarget: number;
  load: (force?: boolean) => Promise<void>;
  /** 슬라이더를 놓았을 때 — 새 목표로 예보를 다시 받는다. */
  setDailyTarget: (dailyTarget: number) => void;
  reset: () => void;
}

const initial = {
  status: 'idle' as Status,
  data: null,
  error: null,
  dailyTarget: DEFAULT_DAILY_TARGET,
};

export const useStudyScheduleStore = create<StudyScheduleState>((set, get) => ({
  ...initial,

  load: async (force = false) => {
    const { status, data, dailyTarget } = get();
    if (status === 'loading') return;
    if (!force && status === 'loaded') return;
    // 이전 그래프를 띄워 둔 채로 받아 온다 — 슬라이더를 움직일 때마다 화면이 비지 않는다.
    set({ status: 'loading', error: null });
    try {
      set({ status: 'loaded', data: await studyScheduleApi.get(dailyTarget), error: null });
    } catch (e: any) {
      set({ status: 'error', data, error: e?.message ?? 'failed' });
    }
  },

  setDailyTarget: (dailyTarget) => {
    if (get().dailyTarget === dailyTarget) return;
    set({ dailyTarget });
    void get().load(true);
  },

  reset: () => set(initial),
}));
