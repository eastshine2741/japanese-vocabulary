import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongSearchItem, SongStudyData } from '../types/song';
import { useAnalysisStore } from './analysisStore';
import {
  trackSongAnalyzeResult,
  trackSongSelect,
  type AnalyzeOutcome,
} from '../services/analytics';

// 'loading' is the cheap existing-song lookup; 'analyzing' means a new analysis was requested
// (the global pill shows it while this store waits for lyrics to auto-open the song).
type Status = 'idle' | 'loading' | 'analyzing' | 'success' | 'error';

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

function analyzeOutcomeOf(errorCode: string | null | undefined): AnalyzeOutcome {
  return errorCode === 'LYRICS_NOT_FOUND' ? 'lyrics_not_found' : 'failed';
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
    const runId = ++analysisRunId;
    set({ status: 'loading', errorCode: null });
    try {
      // 이미 분석 중인 곡을 다시 탭하면 서버에 또 묻지 않고 진행 중인 추적에 올라탄다.
      let readyPromise = useAnalysisStore.getState().readyFor(item.title, item.artistName);
      if (readyPromise) {
        trackSongSelect(undefined, true);
        set({ status: 'analyzing' });
      } else {
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
        if (!accepted.canOpenPlayer) {
          set({ status: 'analyzing' });
        }
        // 여기서는 가사가 준비되는 시점까지만 기다린다. 단어 분석 추적은 analysisStore 몫.
        readyPromise = useAnalysisStore.getState().track(accepted, {
          title: item.title,
          artist: item.artistName,
          artworkUrl: item.thumbnail,
        });
      }
      const ready = await readyPromise;
      if (analysisRunId !== runId) return;
      if (!ready.songId) {
        // 폴링 중 실패는 pill 이 보여준다. error 면 검색 화면 dialog 까지 뜨므로 idle 로 돌린다.
        trackSongAnalyzeResult(analyzeOutcomeOf(ready.errorCode));
        set({ status: 'idle' });
        return;
      }
      const data = await songApi.getStudyDataById(ready.songId);
      if (analysisRunId !== runId) return;
      trackSongAnalyzeResult('success');
      set({ status: 'success', studyData: data, currentMs: 0, durationMs: 0 });
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
