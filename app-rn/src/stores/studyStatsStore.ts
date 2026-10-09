import { create } from 'zustand';
import { studyStatsApi } from '../api/studyStatsApi';
import { HeatmapResponse, HomeStats, ProfileStats, StudyCalendarPage } from '../types/studyStats';

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
  /** 받은 페이지를 이어 붙인 달력. nextBefore 는 가장 오래된 페이지의 것. */
  calendar: Slice<StudyCalendarPage>;
  calendarLoadingMore: boolean;

  loadHome: (force?: boolean) => Promise<void>;
  loadProfile: (force?: boolean) => Promise<void>;
  loadHeatmap: (force?: boolean) => Promise<void>;
  loadCalendar: (force?: boolean) => Promise<void>;
  loadOlderCalendar: () => Promise<void>;
  invalidate: () => void;
}

export const useStudyStatsStore = create<StudyStatsState>((set, get) => ({
  home: emptySlice(),
  profile: emptySlice(),
  heatmap: emptySlice(),
  calendar: emptySlice(),
  calendarLoadingMore: false,

  loadHome: async (force = false) => {
    const cur = get().home;
    if (cur.status === 'loading') return;
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
    if (cur.status === 'loading') return;
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
    if (cur.status === 'loading') return;
    if (!force && cur.status === 'loaded' && cur.staleAt === 0) return;
    set({ heatmap: { ...cur, status: 'loading', error: null } });
    try {
      const data = await studyStatsApi.getHeatmap();
      set({ heatmap: { status: 'loaded', data, error: null, staleAt: 0 } });
    } catch (e: any) {
      set({ heatmap: { status: 'error', data: cur.data, error: e.message ?? 'failed', staleAt: cur.staleAt } });
    }
  },

  loadCalendar: async (force = false) => {
    const cur = get().calendar;
    if (cur.status === 'loading') return;
    if (!force && cur.status === 'loaded' && cur.staleAt === 0) return;
    set({ calendar: { ...cur, status: 'loading', error: null } });
    try {
      const first = await studyStatsApi.getCalendar();
      set({ calendar: { status: 'loaded', data: mergeFirstPage(get().calendar.data, first), error: null, staleAt: 0 } });
    } catch (e: any) {
      set({ calendar: { status: 'error', data: cur.data, error: e.message ?? 'failed', staleAt: cur.staleAt } });
    }
  },

  loadOlderCalendar: async () => {
    const { calendar, calendarLoadingMore } = get();
    const before = calendar.data?.nextBefore;
    if (!before || calendarLoadingMore) return;
    set({ calendarLoadingMore: true });
    try {
      const older = await studyStatsApi.getCalendar(before);
      const latest = get().calendar;
      if (latest.data?.nextBefore === before) {
        set({
          calendar: {
            ...latest,
            data: { days: [...older.days, ...latest.data.days], nextBefore: older.nextBefore },
          },
        });
      }
    } catch {
      // 다음에 첫 달에 닿으면 다시 시도한다.
    } finally {
      set({ calendarLoadingMore: false });
    }
  },

  invalidate: () => {
    const now = Date.now();
    const { home, profile, heatmap, calendar } = get();
    set({
      home: { ...home, staleAt: now },
      profile: { ...profile, staleAt: now },
      heatmap: { ...heatmap, staleAt: now },
      calendar: { ...calendar, staleAt: now },
    });
  },
}));

/** 새로 받은 첫 페이지로 최근 달을 갈아끼우고, 이미 넘겨 본 과거 페이지는 남긴다. */
function mergeFirstPage(prev: StudyCalendarPage | null, first: StudyCalendarPage): StudyCalendarPage {
  const start = first.days[0]?.date;
  if (!prev || !start || prev.days.length === 0 || prev.days[0].date >= start) return first;
  return {
    days: [...prev.days.filter((d) => d.date < start), ...first.days],
    nextBefore: prev.nextBefore,
  };
}
