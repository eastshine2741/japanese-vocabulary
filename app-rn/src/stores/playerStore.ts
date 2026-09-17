import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongSearchItem, SongStudyData } from '../types/song';
import { useAnalysisStore } from './analysisStore';

// 'loading' covers the cheap existing-song lookup (usually well under a second).
// 'analyzing' means a brand-new analysis was actually requested from the server;
// the global analysis pill shows it while this store waits for the lyrics so
// the search screen can auto-open the song.
type Status = 'idle' | 'loading' | 'analyzing' | 'success' | 'error';

interface PlayerState {
  status: Status;
  studyData: SongStudyData | null;
  errorCode: string | null;

  // Playback progress lives in the store so YouTubePlayer's ~100ms time ticks
  // are shared by the focused song detail components without local prop chains.
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
      // 이미 분석 중인 곡을 다시 탭한 경우: 서버에 또 묻지 않고 진행 중인 추적에 올라탄다.
      // 폴링은 analysisStore 가 곡당 하나만 돌린다.
      let readyPromise = useAnalysisStore.getState().readyFor(item.title, item.artistName);
      if (readyPromise) {
        set({ status: 'analyzing' });
      } else {
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
        if (analysisRunId !== runId) return;
        // 요청 자체가 거절된 경우엔 pill 이 뜨지 않으므로 여기서 error 로 알린다.
        if (accepted.status === 'FAILED') {
          set({ status: 'error', errorCode: accepted.errorCode ?? 'SONG_ANALYSIS_WORK_FAILED' });
          return;
        }
        if (!accepted.canOpenPlayer) {
          set({ status: 'analyzing' });
        }
        // 단어 분석까지의 추적은 analysisStore 가 맡는다. 여기서는 가사가 준비돼
        // songDetail 을 열 수 있는 시점까지만 기다린다.
        readyPromise = useAnalysisStore.getState().track(accepted, {
          title: item.title,
          artist: item.artistName,
          artworkUrl: item.thumbnail,
        });
      }
      const ready = await readyPromise;
      if (analysisRunId !== runId) return;
      if (!ready.songId) {
        // 폴링 중 실패는 분석 pill 이 이미 보여준다. error 로 두면 검색 화면이 dialog 까지 띄우므로 idle 로 돌린다.
        set({ status: 'idle' });
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
