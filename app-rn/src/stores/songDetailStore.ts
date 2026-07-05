import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongDetailData } from '../types/song';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface SongDetailState {
  status: Status;
  data: SongDetailData | null;
  errorCode: string | null;
  load: (songId: number) => Promise<void>;
  refreshWords: (songId: number) => Promise<void>;
  reset: () => void;
}

let loadRunId = 0;

export const useSongDetailStore = create<SongDetailState>((set) => ({
  status: 'idle',
  data: null,
  errorCode: null,

  load: async (songId: number) => {
    const runId = ++loadRunId;
    set({ status: 'loading', errorCode: null });
    try {
      const [song, lyrics, words] = await Promise.all([
        songApi.getById(songId),
        songApi.getLyrics(songId),
        songApi.getWords(songId),
      ]);
      if (loadRunId !== runId) return;
      set({ status: 'success', data: { song, lyrics, words } });
    } catch (e: any) {
      if (loadRunId !== runId) return;
      set({ status: 'error', errorCode: e.response?.data?.error ?? 'SONG_DETAIL_LOAD_FAILED' });
    }
  },

  refreshWords: async (songId: number) => {
    const words = await songApi.getWords(songId);
    set(state => {
      if (state.data == null || state.data.song.id !== songId) return state;
      return {
        data: {
          ...state.data,
          words,
        },
        errorCode: null,
      };
    });
  },

  reset: () => {
    loadRunId++;
    set({ status: 'idle', data: null, errorCode: null });
  },
}));
