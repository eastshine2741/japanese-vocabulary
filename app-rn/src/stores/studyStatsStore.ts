import { create } from 'zustand';
import { studyStatsApi } from '../api/studyStatsApi';
import { HeatmapResponse, HomeStats, ProfileStats } from '../types/studyStats';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface Slice<T> {
  status: Status;
  data: T | null;
  error: string | null;
  staleAt: number; // timestamp; 0 = fresh, >0 = invalidated
}

const emptySlice = <T>(): Slice<T> => ({ status: 'idle', data: null, error: null, staleAt: 0 });

interface StudyStatsState {
  home: Slice<HomeStats>;
  profile: Slice<ProfileStats>;
  heatmap: Slice<HeatmapResponse>;

  loadHome: (force?: boolean) => Promise<void>;
  loadProfile: (force?: boolean) => Promise<void>;
  loadHeatmap: (force?: boolean) => Promise<void>;
  invalidate: () => void;
}

export const useStudyStatsStore = create<StudyStatsState>((set, get) => ({
  home: emptySlice(),
  profile: emptySlice(),
  heatmap: emptySlice(),

  loadHome: async (force = false) => {
    const cur = get().home;
    if (!force && cur.status === 'loaded' && cur.staleAt === 0) return;
    set({ home: { ...cur, status: 'loading', error: null } });
    try {
      const data = await studyStatsApi.getHome();
      set({ home: { status: 'loaded', data, error: null, staleAt: 0 } });
    } catch (e: any) {
      set({ home: { status: 'error', data: cur.data, error: e.message ?? 'failed', staleAt: cur.staleAt } });
    }
  },

  loadProfile: async (force = false) => {
    const cur = get().profile;
    if (!force && cur.status === 'loaded' && cur.staleAt === 0) return;
    set({ profile: { ...cur, status: 'loading', error: null } });
    try {
      const data = await studyStatsApi.getProfile();
      set({ profile: { status: 'loaded', data, error: null, staleAt: 0 } });
    } catch (e: any) {
      set({ profile: { status: 'error', data: cur.data, error: e.message ?? 'failed', staleAt: cur.staleAt } });
    }
  },

  loadHeatmap: async (force = false) => {
    const cur = get().heatmap;
    if (!force && cur.status === 'loaded' && cur.staleAt === 0) return;
    set({ heatmap: { ...cur, status: 'loading', error: null } });
    try {
      const data = await studyStatsApi.getHeatmap();
      set({ heatmap: { status: 'loaded', data, error: null, staleAt: 0 } });
    } catch (e: any) {
      set({ heatmap: { status: 'error', data: cur.data, error: e.message ?? 'failed', staleAt: cur.staleAt } });
    }
  },

  invalidate: () => {
    const now = Date.now();
    const { home, profile, heatmap } = get();
    set({
      home: { ...home, staleAt: now },
      profile: { ...profile, staleAt: now },
      heatmap: { ...heatmap, staleAt: now },
    });
  },
}));
