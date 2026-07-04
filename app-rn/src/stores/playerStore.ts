import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongAnalysisWorkResponse, SongSearchItem, SongStudyData } from '../types/song';

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

let analysisRunId = 0;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const usePlayerStore = create<PlayerState>((set, get) => ({
  status: 'idle',
  studyData: null,
  errorCode: null,

  currentMs: 0,
  durationMs: 0,
  setCurrentMs: (ms) => set({ currentMs: ms }),
  setDurationMs: (ms) => set({ durationMs: ms }),

  analyze: async (item: SongSearchItem) => {
    const runId = ++analysisRunId;
    set({ status: 'loading', errorCode: null });
    try {
      const existing = await songApi.getByTitleArtist(item.title, item.artistName);
      if (analysisRunId !== runId) return;
      if (existing) {
        set({ status: 'success', studyData: existing, currentMs: 0, durationMs: 0 });
        return;
      }

      const accepted = await songApi.analyze({
        title: item.title,
        artist: item.artistName,
        durationSeconds: item.durationSeconds,
        artworkUrl: item.thumbnail,
      });
      const ready = await waitForPlayerReady(accepted, runId);
      if (analysisRunId !== runId) return;
      if (!ready.songId) {
        set({ status: 'error', errorCode: ready.errorCode ?? 'SONG_ANALYSIS_WORK_FAILED' });
        return;
      }
      const data = await songApi.getStudyDataById(ready.songId);
      if (analysisRunId !== runId) return;
      set({ status: 'success', studyData: data, currentMs: 0, durationMs: 0 });
    } catch (e: any) {
      if (analysisRunId !== runId) return;
      set({ status: 'error', errorCode: e.response?.data?.error });
    }
  },

  loadById: async (id: number) => {
    set({ status: 'loading', errorCode: null });
    try {
      const data = await songApi.getStudyDataById(id);
      set({ status: 'success', studyData: data, currentMs: 0, durationMs: 0 });
    } catch (e: any) {
      set({ status: 'error', errorCode: e.response?.data?.error });
    }
  },

  refreshStudyData: async () => {
    const current = get().studyData;
    if (!current) return;
    try {
      const data = await songApi.getStudyDataById(current.song.id);
      set({ studyData: data });
    } catch {
      // silent — manual retry button stays available
    }
  },

  reset: () => {
    analysisRunId++;
    set({ status: 'idle', studyData: null, errorCode: null, currentMs: 0, durationMs: 0 });
  },
}));

async function waitForPlayerReady(
  initial: SongAnalysisWorkResponse,
  runId: number,
): Promise<SongAnalysisWorkResponse> {
  let current = initial;
  while (analysisRunId === runId) {
    if (current.canOpenPlayer && current.songId != null) {
      return current;
    }
    if (current.status === 'FAILED') {
      return current;
    }
    await sleep(ANALYSIS_POLL_INTERVAL_MS);
    if (analysisRunId !== runId) {
      return current;
    }
    current = await songApi.getAnalysisWork(current.workId);
  }
  return current;
}

const ANALYSIS_POLL_INTERVAL_MS = 3000;
