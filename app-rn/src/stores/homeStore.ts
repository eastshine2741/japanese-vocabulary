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

export const useHomeStore = create<HomeState>((set) => ({
  status: 'loading',
  songs: [],
  error: null,

  load: async () => {
    set({ status: 'loading', error: null });
    try {
      const songs = await songApi.getRecent();
      set({ status: 'success', songs });
    } catch (e: any) {
      set({ status: 'error', error: e.message || 'Failed to load recent songs' });
    }
  },
}));
