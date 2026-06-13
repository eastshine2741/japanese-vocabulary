import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongStudyData } from '../types/song';

type SpotlightStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

interface SpotlightState {
  status: SpotlightStatus;
  data: SongStudyData | null;
  error: string | null;
  load: () => Promise<void>;
}

export const useSpotlightStore = create<SpotlightState>((set, get) => ({
  status: 'idle',
  data: null,
  error: null,

  load: async () => {
    const hasData = get().data != null;
    if (!hasData) set({ status: 'loading', error: null });
    try {
      const data = await songApi.getSpotlight();
      if (data == null) {
        set({ status: 'empty', data: null, error: null });
      } else {
        set({ status: 'success', data, error: null });
      }
    } catch (e: any) {
      const msg = e.message || 'Failed to load spotlight';
      if (hasData) set({ error: msg });
      else set({ status: 'error', error: msg });
    }
  },
}));
