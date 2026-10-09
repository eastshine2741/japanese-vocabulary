import { create } from 'zustand';
import { studyScheduleApi } from '../api/studyScheduleApi';
import { StudyScheduleResponse } from '../types/studySchedule';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface StudyScheduleState {
  status: Status;
  data: StudyScheduleResponse | null;
  error: string | null;
  load: (force?: boolean) => Promise<void>;
  reset: () => void;
}

const initial = {
  status: 'idle' as Status,
  data: null,
  error: null,
};

export const useStudyScheduleStore = create<StudyScheduleState>((set, get) => ({
  ...initial,

  load: async (force = false) => {
    const { status, data } = get();
    if (status === 'loading') return;
    if (!force && status === 'loaded') return;
    // 다시 들어올 때 이전 그래프를 띄워 둔 채로 받아 온다.
    set({ status: 'loading', error: null });
    try {
      set({ status: 'loaded', data: await studyScheduleApi.get(), error: null });
    } catch (e: any) {
      set({ status: 'error', data, error: e?.message ?? 'failed' });
    }
  },

  reset: () => set(initial),
}));
