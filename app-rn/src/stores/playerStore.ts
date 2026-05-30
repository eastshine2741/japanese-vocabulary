import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongSearchItem, SongStudyData } from '../types/song';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface PlayerState {
  status: Status;
  studyData: SongStudyData | null;
  errorCode: string | null;

  // Playback progress lives in the store (not PlayerScreen state) so the
  // YouTubePlayer's ~100ms time ticks don't force a re-render of the whole
  // PlayerScreen tree. Only components that actually need the tick
  // (LyricsDial) subscribe to currentMs.
  currentMs: number;
  durationMs: number;
  setCurrentMs: (ms: number) => void;
  setDurationMs: (ms: number) => void;

  analyze: (item: SongSearchItem) => Promise<void>;
  loadById: (id: number) => Promise<void>;
  refreshStudyData: () => Promise<void>;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  status: 'idle',
  studyData: null,
  errorCode: null,

  currentMs: 0,
  durationMs: 0,
  setCurrentMs: (ms) => set({ currentMs: ms }),
  setDurationMs: (ms) => set({ durationMs: ms }),

  analyze: async (item: SongSearchItem) => {
    set({ status: 'loading', errorCode: null });
    try {
      const data = await songApi.analyze({
        title: item.title,
        artist: item.artistName,
        durationSeconds: item.durationSeconds,
        artworkUrl: item.thumbnail,
      });
      set({ status: 'success', studyData: data, currentMs: 0, durationMs: 0 });
    } catch (e: any) {
      set({ status: 'error', errorCode: e.response?.data?.error });
    }
  },

  loadById: async (id: number) => {
    set({ status: 'loading', errorCode: null });
    try {
      const data = await songApi.getById(id);
      set({ status: 'success', studyData: data, currentMs: 0, durationMs: 0 });
    } catch (e: any) {
      set({ status: 'error', errorCode: e.response?.data?.error });
    }
  },

  refreshStudyData: async () => {
    const current = get().studyData;
    if (!current) return;
    try {
      const data = await songApi.getById(current.song.id);
      set({ studyData: data });
    } catch {
      // silent — manual retry button stays available
    }
  },

  reset: () => set({ status: 'idle', studyData: null, errorCode: null, currentMs: 0, durationMs: 0 }),
}));
