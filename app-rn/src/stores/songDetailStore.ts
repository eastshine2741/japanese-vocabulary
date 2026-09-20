import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongDetailData, SongWordStagesDto } from '../types/song';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface SongDetailState {
  status: Status;
  songId: number | null;
  data: SongDetailData | null;
  /** 학습 로드맵. 실패해도 화면은 열리므로 data 와 분리해 둔다. */
  stages: SongWordStagesDto | null;
  errorCode: string | null;
  load: (songId: number) => Promise<void>;
  refreshWords: (songId: number) => Promise<void>;
  refreshStages: (songId: number) => Promise<void>;
  reset: () => void;
}

let loadRunId = 0;

export const useSongDetailStore = create<SongDetailState>((set) => ({
  status: 'idle',
  songId: null,
  data: null,
  stages: null,
  errorCode: null,

  load: async (songId: number) => {
    const runId = ++loadRunId;
    set(state => ({
      status: 'loading',
      songId,
      errorCode: null,
      data: state.data?.song.id === songId ? state.data : null,
      stages: state.stages?.songId === songId ? state.stages : null,
    }));
    try {
      const [song, lyrics, words, stages] = await Promise.all([
        songApi.getById(songId),
        songApi.getLyrics(songId),
        songApi.getWords(songId),
        songApi.getWordStages(songId).catch(() => null),
      ]);
      if (loadRunId !== runId) return;
      set({ status: 'success', data: { song, lyrics, words }, stages });
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

  refreshStages: async (songId: number) => {
    const stages = await songApi.getWordStages(songId);
    set(state => (state.songId === songId ? { stages } : state));
  },

  reset: () => {
    loadRunId++;
    set({ status: 'idle', songId: null, data: null, stages: null, errorCode: null });
  },
}));
