import { create } from 'zustand';
import { karaokeApi } from '../api/karaokeApi';
import { KaraokeDailyGroup, KaraokeMonthly } from '../types/karaoke';
import { currentYearMonth, shiftYearMonth } from '../utils/yearMonth';

type Status = 'idle' | 'loading' | 'success' | 'error';

/** daily 응답이 달 단위라 목록 끝에서 이전 달을 당겨 온다. 빈 달이 이어지면 멈춘다. */
const MAX_EMPTY_MONTHS = 3;

const LOAD_ERROR = '노래방 신곡을 불러오지 못했어요';

/** loadDaily 가 목록을 갈아끼울 때 올린다. 그 전에 시작한 이전 달 요청은 결과를 버린다 — 안 그러면 같은 달이 두 번 붙는다. */
let dailyGeneration = 0;

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
  loadDaily: () => Promise<void>;
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

  loadDaily: async () => {
    const hasData = get().daily.groups.length > 0;
    if (!hasData) set((s) => ({ daily: { ...s.daily, status: 'loading', error: null } }));

    const generation = ++dailyGeneration;
    const month = currentYearMonth();
    try {
      const groups = await karaokeApi.getDaily(month);
      const seed = groups.length > 0 ? { month, groups } : await fetchOlder(month);
      if (generation !== dailyGeneration) return;
      dailyGeneration += 1;
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
      if (generation !== dailyGeneration) return;
      dailyGeneration += 1;
      const error = e?.message ?? LOAD_ERROR;
      set((s) => ({
        daily: hasData
          ? { ...s.daily, loadingMore: false, error }
          : { ...s.daily, status: 'error', loadingMore: false, error },
      }));
    }
  },

  loadOlderDaily: async () => {
    const { daily } = get();
    if (daily.status !== 'success' || daily.loadingMore || daily.exhausted) return;

    const generation = dailyGeneration;
    set({ daily: { ...daily, loadingMore: true } });
    try {
      const older = await fetchOlder(daily.oldestMonth);
      if (generation !== dailyGeneration) return;
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
      if (generation !== dailyGeneration) return;
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

  reset: () => {
    dailyGeneration += 1;
    set({ daily: initialDaily(), monthly: initialMonthly() });
  },
}));
