import { create } from 'zustand';
import { karaokeApi } from '../api/karaokeApi';
import { KaraokeDailyGroup, KaraokeMonthly } from '../types/karaoke';
import { currentYearMonth, shiftYearMonth } from '../utils/yearMonth';

type Status = 'idle' | 'loading' | 'success' | 'error';

/** daily 응답이 달 단위라 목록 끝에서 이전 달을 당겨 온다. 빈 달이 이어지면 멈춘다. */
const MAX_EMPTY_MONTHS = 3;

const LOAD_ERROR = '노래방 신곡을 불러오지 못했어요';

interface DailyState {
  status: Status;
  groups: KaraokeDailyGroup[];
  /** 지금까지 당겨 온 가장 오래된 달. */
  oldestMonth: string;
  loadingMore: boolean;
  exhausted: boolean;
  error: string | null;
}

interface MonthlyState {
  status: Status;
  month: string;
  data: KaraokeMonthly | null;
  error: string | null;
}

interface KaraokeState {
  daily: DailyState;
  monthly: MonthlyState;
  loadDaily: (force?: boolean) => Promise<void>;
  loadOlderDaily: () => Promise<void>;
  loadMonthly: (month: string) => Promise<void>;
  stepMonth: (delta: number) => Promise<void>;
  reset: () => void;
}

const initialDaily = (): DailyState => ({
  status: 'idle',
  groups: [],
  oldestMonth: currentYearMonth(),
  loadingMore: false,
  exhausted: false,
  error: null,
});

const initialMonthly = (): MonthlyState => ({
  status: 'idle',
  month: currentYearMonth(),
  data: null,
  error: null,
});

async function fetchOlder(from: string): Promise<{ month: string; groups: KaraokeDailyGroup[] }> {
  let month = from;
  for (let empty = 0; empty < MAX_EMPTY_MONTHS; empty += 1) {
    month = shiftYearMonth(month, -1);
    const groups = await karaokeApi.getDaily(month);
    if (groups.length > 0) return { month, groups };
  }
  return { month, groups: [] };
}

export const useKaraokeStore = create<KaraokeState>((set, get) => ({
  daily: initialDaily(),
  monthly: initialMonthly(),

  loadDaily: async (force = false) => {
    const { daily } = get();
    if (!force && (daily.status === 'loading' || daily.status === 'success')) return;

    const month = currentYearMonth();
    set({ daily: { ...daily, status: 'loading', error: null } });
    try {
      const groups = await karaokeApi.getDaily(month);
      const seed = groups.length > 0 ? { month, groups } : await fetchOlder(month);
      set({
        daily: {
          status: 'success',
          groups: seed.groups,
          oldestMonth: seed.month,
          loadingMore: false,
          exhausted: seed.groups.length === 0,
          error: null,
        },
      });
    } catch (e: any) {
      set({ daily: { ...get().daily, status: 'error', error: e?.message ?? LOAD_ERROR } });
    }
  },

  loadOlderDaily: async () => {
    const { daily } = get();
    if (daily.status !== 'success' || daily.loadingMore || daily.exhausted) return;

    set({ daily: { ...daily, loadingMore: true } });
    try {
      const older = await fetchOlder(daily.oldestMonth);
      set((s) => ({
        daily: {
          ...s.daily,
          groups: [...s.daily.groups, ...older.groups],
          oldestMonth: older.month,
          loadingMore: false,
          exhausted: older.groups.length === 0,
        },
      }));
    } catch {
      set((s) => ({ daily: { ...s.daily, loadingMore: false } }));
    }
  },

  loadMonthly: async (month: string) => {
    set((s) => ({ monthly: { ...s.monthly, status: 'loading', month, error: null } }));
    try {
      const data = await karaokeApi.getMonthly(month);
      set((s) => (s.monthly.month === month ? { monthly: { status: 'success', month, data, error: null } } : s));
    } catch (e: any) {
      set((s) =>
        s.monthly.month === month
          ? { monthly: { ...s.monthly, status: 'error', error: e?.message ?? LOAD_ERROR } }
          : s,
      );
    }
  },

  stepMonth: async (delta: number) => {
    await get().loadMonthly(shiftYearMonth(get().monthly.month, delta));
  },

  reset: () => set({ daily: initialDaily(), monthly: initialMonthly() }),
}));
