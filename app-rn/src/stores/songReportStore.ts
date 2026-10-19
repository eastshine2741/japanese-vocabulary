import { create } from 'zustand';
import { songReportApi } from '../api/songReportApi';
import { SongReportTypeDto } from '../types/songReport';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface SongReportState {
  types: SongReportTypeDto[];
  status: Status;
  loadTypes: () => Promise<void>;
}

/** 유형 목록은 곡과 무관한 서버 상수라 앱 수명 동안 한 번만 받는다. */
export const useSongReportStore = create<SongReportState>((set, get) => ({
  types: [],
  status: 'idle',

  loadTypes: async () => {
    const status = get().status;
    if (status === 'loading' || status === 'success') return;
    set({ status: 'loading' });
    try {
      set({ types: await songReportApi.getTypes(), status: 'success' });
    } catch {
      set({ status: 'error' });
    }
  },
}));
