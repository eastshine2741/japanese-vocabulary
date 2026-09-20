import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongAnalysisWorkResponse } from '../types/song';
import { AnalysisJob, SETTLED_HOLD_MS } from '../components/analysisPill/pillState';
import { AnalysisPillDock, preferenceStorage } from '../utils/preferenceStorage';
import { useSongDetailStore } from './songDetailStore';

// 분석 pill 이 보여주는 작업 목록. 검색 화면을 떠나도 분석은 계속 추적돼야 하므로
// 폴링이 화면이 아니라 여기 산다. playerStore 는 가사 준비 시점(자동 이동)까지만 기다린다.

interface AnalysisSongInfo {
  title: string;
  artist: string;
  artworkUrl: string | null;
}

interface AnalysisState {
  jobs: AnalysisJob[];
  dock: AnalysisPillDock;
  expanded: boolean;
  /**
   * 수락된 분석 작업을 추적한다. 가사가 준비되거나(songId 확보) 실패하면 resolve 된다.
   * 단어 분석까지는 pill 이 이어서 지켜본다.
   * 같은 작업을 다시 넘기면 새 폴링을 띄우지 않고 진행 중인 추적의 promise 를 돌려준다.
   */
  track: (accepted: SongAnalysisWorkResponse, song: AnalysisSongInfo) => Promise<SongAnalysisWorkResponse>;
  /**
   * 이미 분석 중인 곡이면 그 추적의 promise 를, 아니면 null 을 돌려준다.
   * 검색 결과를 다시 탭했을 때 서버에 또 묻지 않고 진행 중인 추적에 올라타기 위한 것.
   */
  readyFor: (title: string, artist: string) => Promise<SongAnalysisWorkResponse> | null;
  /** 실패 pill 을 탭했을 때. 유지 시간을 기다리지 않고 바로 지운다. */
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
// workId 별 폴링 결과(가사 준비 시점) promise. 곡당 폴링이 하나만 돌게 하는 장부다.
const readyPromises = new Map<number, Promise<SongAnalysisWorkResponse>>();

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
    readyPromises.delete(workId);
    set(state => {
      const jobs = state.jobs.filter(j => j.workId !== workId);
      return { jobs, expanded: jobs.length > 1 ? state.expanded : false };
    });
  };

  const holdThenRemove = (workId: number) => {
    holdTimers.set(workId, setTimeout(() => removeJob(workId), SETTLED_HOLD_MS));
  };

  const finishJob = (workId: number, songId: number) => {
    patchJob(workId, { phase: 'done', songId, settledAt: Date.now() });
    // 완료 곡의 songDetail 을 이미 보고 있으면 "단어 분석 중" placeholder 를 바로 걷는다.
    // 로드맵(tiers)은 분석 전에 빈 4단계로 받아 둔 상태라 함께 다시 가져와야 0개짜리 티어가 안 남는다.
    const songDetail = useSongDetailStore.getState();
    if (songDetail.data?.song.id === songId) {
      songDetail.refreshWords(songId).catch(() => undefined);
      songDetail.refreshTiers(songId).catch(() => undefined);
    }
    holdThenRemove(workId);
  };

  const failJob = (workId: number, errorCode: string | null) => {
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
      if (accepted.status === 'FAILED') return Promise.resolve(accepted);
      const existing = readyPromises.get(workId);
      if (existing) return existing;
      set(state => ({
        jobs: [...state.jobs, {
          workId,
          title: song.title,
          artist: song.artist,
          artworkUrl: song.artworkUrl,
          songId: accepted.songId,
          phase: 'analyzing',
          settledAt: null,
          errorCode: null,
        }],
      }));

      let current = accepted;
      let playerReady: ((r: SongAnalysisWorkResponse) => void) | null = null;
      const playerReadyPromise = new Promise<SongAnalysisWorkResponse>(resolve => { playerReady = resolve; });
      readyPromises.set(workId, playerReadyPromise);
      const settlePlayer = (r: SongAnalysisWorkResponse) => {
        playerReady?.(r);
        playerReady = null;
      };

      (async () => {
        while (trackingGeneration === generation && get().jobs.some(j => j.workId === workId)) {
          if (current.songId != null && current.canOpenPlayer) {
            patchJob(workId, { songId: current.songId });
            settlePlayer(current);
          }
          if (current.status === 'FAILED') {
            settlePlayer(current);
            failJob(workId, current.errorCode);
            return;
          }
          if (current.isAnalysisComplete && current.songId != null) {
            settlePlayer(current);
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
        settlePlayer(current);
      })();

      return playerReadyPromise;
    },

    readyFor: (title, artist) => {
      const job = findAnalyzingJob(get().jobs, title, artist);
      return job ? readyPromises.get(job.workId) ?? null : null;
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
      readyPromises.clear();
      set({ jobs: [], expanded: false });
    },
  };
});
