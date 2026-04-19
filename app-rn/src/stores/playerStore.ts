import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongSearchItem, SongStudyData } from '../types/song';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface PlayerState {
  status: Status;
  studyData: SongStudyData | null;
  error: string | null;

  analyze: (item: SongSearchItem) => Promise<void>;
  loadById: (id: number) => Promise<void>;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  status: 'idle',
  studyData: null,
  error: null,

  analyze: async (item: SongSearchItem) => {
    set({ status: 'loading', error: null });
    try {
      const data = await songApi.analyze({
        title: item.title,
        artist: item.artistName,
        durationSeconds: item.durationSeconds,
        artworkUrl: item.thumbnail,
      });
      set({ status: 'success', studyData: data });
    } catch (e: any) {
      set({ status: 'error', error: e.response?.data?.message ?? e.message });
    }
  },

  loadById: async (id: number) => {
    set({ status: 'loading', error: null });
    try {
      const data = await songApi.getById(id);
      set({ status: 'success', studyData: data });
    } catch (e: any) {
      set({ status: 'error', error: e.response?.data?.message ?? e.message });
    }
  },

  reset: () => set({ status: 'idle', studyData: null, error: null }),
}));
