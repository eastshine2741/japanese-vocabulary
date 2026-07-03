import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { RecommendedSongItem } from '../types/song';

type RecommendationStatus = 'loading' | 'success' | 'error';

interface RecommendationState {
  status: RecommendationStatus;
  songs: RecommendedSongItem[];
  error: string | null;
  load: () => Promise<void>;
}

export const useRecommendationStore = create<RecommendationState>((set, get) => ({
  status: 'loading',
  songs: [],
  error: null,

  load: async () => {
    const hasData = get().songs.length > 0;
    if (!hasData) set({ status: 'loading', error: null });
    try {
      const songs = await songApi.getRecommendations();
      set({ status: 'success', songs, error: null });
    } catch (e: any) {
      const msg = e.message || 'Failed to load recommended songs';
      if (hasData) set({ error: msg });
      else set({ status: 'error', error: msg });
    }
  },
}));
