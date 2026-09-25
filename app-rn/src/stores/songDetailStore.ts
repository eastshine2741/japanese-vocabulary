import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongCoverageDto, SongDetailData, SongWordTiersDto } from '../types/song';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface SongDetailState {
  status: Status;
  songId: number | null;
  data: SongDetailData | null;
  /** 완곡까지 3단계. 실패해도 화면은 열리므로 data 와 분리해 둔다. null 이면 그 섹션을 그리지 않는다. */
  tiers: SongWordTiersDto | null;
  /** 이 곡 이해도. null 이면 그 섹션을 그리지 않는다. */
  coverage: SongCoverageDto | null;
  errorCode: string | null;
  load: (songId: number) => Promise<void>;
  refreshWords: (songId: number) => Promise<void>;
  refreshTiers: (songId: number) => Promise<void>;
  refreshCoverage: (songId: number) => Promise<void>;
  reset: () => void;
}

let loadRunId = 0;

export const useSongDetailStore = create<SongDetailState>((set) => ({
  status: 'idle',
  songId: null,
  data: null,
  tiers: null,
  coverage: null,
  errorCode: null,

  load: async (songId: number) => {
    const runId = ++loadRunId;
    set(state => ({
      status: 'loading',
      songId,
      errorCode: null,
      data: state.data?.song.id === songId ? state.data : null,
      tiers: state.tiers?.songId === songId ? state.tiers : null,
      coverage: state.coverage?.songId === songId ? state.coverage : null,
    }));
    try {
      const [song, lyrics, words, tiers, coverage] = await Promise.all([
        songApi.getById(songId),
        songApi.getLyrics(songId),
        songApi.getWords(songId),
        songApi.getWordTiers(songId).catch(() => null),
        songApi.getCoverage(songId).catch(() => null),
      ]);
      if (loadRunId !== runId) return;
      set({ status: 'success', data: { song, lyrics, words }, tiers, coverage });
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

  refreshTiers: async (songId: number) => {
    const tiers = await songApi.getWordTiers(songId);
    set(state => (state.songId === songId ? { tiers } : state));
  },

  refreshCoverage: async (songId: number) => {
    const coverage = await songApi.getCoverage(songId);
    set(state => (state.songId === songId ? { coverage } : state));
  },

  reset: () => {
    loadRunId++;
    set({ status: 'idle', songId: null, data: null, tiers: null, coverage: null, errorCode: null });
  },
}));
