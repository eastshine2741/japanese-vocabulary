import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongAnalysisWorkResponse } from '../types/song';
import { AnalysisJob, SETTLED_HOLD_MS } from '../components/analysisPill/pillState';
import { analyzeOutcomeOf, trackSongAnalyzeResult } from '../services/analytics';
import { AnalysisPillDock, preferenceStorage } from '../utils/preferenceStorage';
import { useSongDetailStore } from './songDetailStore';

// 분석 pill 의 작업 목록. 화면을 떠나도 추적돼야 하므로 폴링이 여기 산다.

interface AnalysisSongInfo {
  title: string;
  artist: string;
  artworkUrl: string | null;
}

interface AnalysisState {
  jobs: AnalysisJob[];
  dock: AnalysisPillDock;
  expanded: boolean;
  /** 끝날 때까지 pill 로 보여준다. 끝나도 곡으로 데려가지 않는다 — 완료 pill 을 탭해야 간다. */
  track: (accepted: SongAnalysisWorkResponse, song: AnalysisSongInfo) => void;
  /** 실패 pill 은 유지 시간을 기다리지 않고, 완료 pill 은 곡을 열 때 지운다. */
  dismiss: (workId: number) => void;
  setDock: (dock: AnalysisPillDock) => void;
  setExpanded: (expanded: boolean) => void;
  loadDock: () => Promise<void>;
  reset: () => void;
}

const POLL_INTERVAL_MS = 3000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let trackingGeneration = 0;
const holdTimers = new Map<number, ReturnType<typeof setTimeout>>();

/** 서버가 곡을 (title, artist) 로 식별하므로 진행 중 여부도 같은 키로 찾는다. */
const findAnalyzingJob = (jobs: AnalysisJob[], title: string, artist: string) =>
  jobs.find(j => j.phase === 'analyzing' && j.title === title && j.artist === artist);

/** 검색 결과 row 가 chevron 대신 스피너를 보여줘야 하는지. */
export const isAnalyzingSong = (jobs: AnalysisJob[], title: string, artist: string) =>
  findAnalyzingJob(jobs, title, artist) != null;

export const useAnalysisStore = create<AnalysisState>((set, get) => {
  const patchJob = (workId: number, patch: Partial<AnalysisJob>) =>
    set(state => ({ jobs: state.jobs.map(j => (j.workId === workId ? { ...j, ...patch } : j)) }));

  const removeJob = (workId: number) => {
    const timer = holdTimers.get(workId);
    if (timer) clearTimeout(timer);
    holdTimers.delete(workId);
    set(state => {
      const jobs = state.jobs.filter(j => j.workId !== workId);
      return { jobs, expanded: jobs.length > 1 ? state.expanded : false };
    });
  };

  const holdThenRemove = (workId: number) => {
    holdTimers.set(workId, setTimeout(() => removeJob(workId), SETTLED_HOLD_MS));
  };

  const finishJob = (workId: number, songId: number) => {
    trackSongAnalyzeResult('success');
    // 완료 pill 은 곡으로 들어가는 길이라 탭할 때까지 남긴다.
    patchJob(workId, { phase: 'done', songId, settledAt: Date.now() });
    // 이미 보고 있는 곡이면 placeholder 를 걷는다. tiers·coverage 는 분석 전에 빈 값으로 받았으므로 함께 갱신한다.
    const songDetail = useSongDetailStore.getState();
    if (songDetail.data?.song.id === songId) {
      songDetail.refreshWords(songId).catch(() => undefined);
      songDetail.refreshTiers(songId).catch(() => undefined);
      songDetail.refreshCoverage(songId).catch(() => undefined);
    }
  };

  const failJob = (workId: number, errorCode: string | null) => {
    trackSongAnalyzeResult(analyzeOutcomeOf(errorCode));
    patchJob(workId, { phase: 'failed', errorCode, settledAt: Date.now() });
    holdThenRemove(workId);
  };

  return {
    jobs: [],
    dock: 'bottom',
    expanded: false,

    track: (accepted, song) => {
      const generation = trackingGeneration;
      const workId = accepted.workId;
      if (accepted.status === 'FAILED') return;
      if (get().jobs.some(j => j.workId === workId)) return;
      set(state => ({
        jobs: [...state.jobs, {
          workId,
          title: song.title,
          artist: song.artist,
          artworkUrl: song.artworkUrl,
          songId: null,
          phase: 'analyzing',
          settledAt: null,
          errorCode: null,
        }],
      }));

      let current = accepted;
      (async () => {
        while (trackingGeneration === generation && get().jobs.some(j => j.workId === workId)) {
          if (current.status === 'FAILED') {
            failJob(workId, current.errorCode);
            return;
          }
          if (current.isAnalysisComplete && current.songId != null) {
            finishJob(workId, current.songId);
            return;
          }
          await sleep(POLL_INTERVAL_MS);
          try {
            current = await songApi.getAnalysisWork(workId);
          } catch {
            // 일시적 네트워크 오류는 다음 폴링에서 다시 시도한다.
          }
        }
      })();
    },

    dismiss: (workId) => removeJob(workId),

    setDock: (dock) => {
      set({ dock });
      preferenceStorage.saveAnalysisPillDock(dock).catch(() => undefined);
    },

    setExpanded: (expanded) => set({ expanded }),

    loadDock: async () => {
      const dock = await preferenceStorage.getAnalysisPillDock().catch(() => null);
      if (dock) set({ dock });
    },

    reset: () => {
      trackingGeneration++;
      holdTimers.forEach(clearTimeout);
      holdTimers.clear();
      set({ jobs: [], expanded: false });
    },
  };
});
