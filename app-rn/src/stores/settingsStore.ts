import { create } from 'zustand';
import { flashcardApi } from '../api/flashcardApi';
import type { ReadingDisplay } from '../utils/readingConverter';

type SettingsStatus = 'loading' | 'loaded' | 'error';

interface SettingsState {
  status: SettingsStatus;
  requestRetention: number;
  showIntervals: boolean;
  readingDisplay: ReadingDisplay;
  isSaving: boolean;
  saveSuccess: boolean;
  error: string | null;

  loadSettings: () => Promise<void>;
  setRetention: (value: number) => void;
  setShowIntervals: (value: boolean) => void;
  setReadingDisplay: (value: ReadingDisplay) => void;
  save: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  status: 'loading',
  requestRetention: 0.9,
  showIntervals: true,
  readingDisplay: 'KATAKANA',
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
      });
    } catch (e: any) {
      set({ status: 'error', error: e.message });
    }
  },

  setRetention: (value) => set({ requestRetention: value, saveSuccess: false }),
  setShowIntervals: (value) => set({ showIntervals: value, saveSuccess: false }),
  setReadingDisplay: (value) => set({ readingDisplay: value, saveSuccess: false }),

  save: async () => {
    const { requestRetention, showIntervals, readingDisplay } = get();
    set({ isSaving: true, saveSuccess: false });
    try {
      await flashcardApi.updateSettings({ requestRetention, showIntervals, readingDisplay });
      set({ isSaving: false, saveSuccess: true });
    } catch {
      set({ isSaving: false });
    }
  },
}));
