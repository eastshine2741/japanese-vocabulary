import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongSearchItem, SongStudyData } from '../types/song';
import { isAnalyzingSong, useAnalysisStore } from './analysisStore';
import { analyzeOutcomeOf, trackSongAnalyzeResult, trackSongSelect } from '../services/analytics';

// 'loading' covers the existing-song lookup and the analysis request. Once accepted, the global pill
// owns the analysis and this store goes back to 'idle' — the song opens only from the pill.
type Status = 'idle' | 'loading' | 'success' | 'error';

interface PlayerState {
  status: Status;
  studyData: SongStudyData | null;
  errorCode: string | null;

  // Playback progress lives here so YouTubePlayer's ~100ms ticks are shared without prop chains.
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
      // 이미 분석 중인 곡이면 pill 이 이미 보여주고 있다.
      if (isAnalyzingSong(useAnalysisStore.getState().jobs, item.title, item.artistName)) {
        set({ status: 'idle' });
        return;
      }
      const existing = await songApi.getByTitleArtist(item.title, item.artistName);
      if (analysisRunId !== runId) return;
      if (existing) {
        trackSongSelect(existing.song.id, false);
        trackSongAnalyzeResult('success');
        set({ status: 'success', studyData: existing, currentMs: 0, durationMs: 0 });
        return;
      }
      trackSongSelect(undefined, true);

      const accepted = await songApi.analyze({
        title: item.title,
        artist: item.artistName,
        durationSeconds: item.durationSeconds,
        artworkUrl: item.thumbnail,
      });
      if (analysisRunId !== runId) return;
      // 요청 자체가 거절된 경우엔 pill 이 뜨지 않으므로 여기서 error 로 알린다.
      if (accepted.status === 'FAILED') {
        const errorCode = accepted.errorCode ?? 'SONG_ANALYSIS_WORK_FAILED';
        trackSongAnalyzeResult(analyzeOutcomeOf(errorCode));
        set({ status: 'error', errorCode });
        return;
      }
      useAnalysisStore.getState().track(accepted, {
        title: item.title,
        artist: item.artistName,
        artworkUrl: item.thumbnail,
      });
      set({ status: 'idle' });
    } catch (e: any) {
      if (analysisRunId !== runId) return;
      const errorCode = e.response?.data?.error;
      trackSongAnalyzeResult(analyzeOutcomeOf(errorCode));
      set({ status: 'error', errorCode });
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
