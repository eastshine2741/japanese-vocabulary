import { create } from 'zustand';
import { flashcardApi } from '../api/flashcardApi';
import type { ReadingDisplay } from '../utils/readingConverter';

type SettingsStatus = 'loading' | 'loaded' | 'error';

interface SettingsState {
  status: SettingsStatus;
  requestRetention: number;
  showIntervals: boolean;
  readingDisplay: ReadingDisplay;
  showKoreanPronunciation: boolean;
  showFurigana: boolean;
  dailyGoal: number;
  isSaving: boolean;
  saveSuccess: boolean;
  error: string | null;

  loadSettings: () => Promise<void>;
  setRetention: (value: number) => void;
  setShowIntervals: (value: boolean) => void;
  setReadingDisplay: (value: ReadingDisplay) => void;
  setShowKoreanPronunciation: (value: boolean) => void;
  setShowFurigana: (value: boolean) => void;
  setDailyGoal: (value: number) => void;
  save: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  status: 'loading',
  requestRetention: 0.9,
  showIntervals: true,
  readingDisplay: 'KATAKANA',
  showKoreanPronunciation: true,
  showFurigana: true,
  dailyGoal: 10,
  isSaving: false,
  saveSuccess: false,
  error: null,

  loadSettings: async () => {
    set({ status: 'loading', error: null });
    try {
      const settings = await flashcardApi.getSettings();
      set({
        status: 'loaded',
        requestRetention: settings.requestRetention,
        showIntervals: settings.showIntervals,
        readingDisplay: settings.readingDisplay,
        showKoreanPronunciation: settings.showKoreanPronunciation,
        showFurigana: settings.showFurigana,
        dailyGoal: settings.dailyGoal,
      });
    } catch (e: any) {
      set({ status: 'error', error: e.message });
    }
  },

  setRetention: (value) => set({ requestRetention: value, saveSuccess: false }),
  setShowIntervals: (value) => set({ showIntervals: value, saveSuccess: false }),
  setReadingDisplay: (value) => set({ readingDisplay: value, saveSuccess: false }),
  setShowKoreanPronunciation: (value) => set({ showKoreanPronunciation: value, saveSuccess: false }),
  setShowFurigana: (value) => set({ showFurigana: value, saveSuccess: false }),
  setDailyGoal: (value) => set({ dailyGoal: Math.max(1, Math.min(50000, Math.round(value))), saveSuccess: false }),

  save: async () => {
    const { requestRetention, showIntervals, readingDisplay, showKoreanPronunciation, showFurigana, dailyGoal } = get();
    set({ isSaving: true, saveSuccess: false });
    try {
      await flashcardApi.updateSettings({ requestRetention, showIntervals, readingDisplay, showKoreanPronunciation, showFurigana, dailyGoal });
      set({ isSaving: false, saveSuccess: true });
    } catch {
      set({ isSaving: false });
    }
  },
}));
