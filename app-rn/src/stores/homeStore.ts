import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { RecentSongItem } from '../types/song';

type HomeStatus = 'loading' | 'success' | 'error';

interface HomeState {
  status: HomeStatus;
  songs: RecentSongItem[];
  error: string | null;
  load: () => Promise<void>;
}

export const useHomeStore = create<HomeState>((set, get) => ({
  status: 'loading',
  songs: [],
  error: null,

  load: async () => {
    const hasData = get().songs.length > 0;
    if (!hasData) set({ status: 'loading', error: null });
    try {
      const songs = await songApi.getRecent();
      set({ status: 'success', songs, error: null });
    } catch (e: any) {
      const msg = e.message || 'Failed to load recent songs';
      if (hasData) set({ error: msg });
      else set({ status: 'error', error: msg });
    }
  },
}));
