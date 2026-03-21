import { create } from 'zustand';
import { flashcardApi } from '../api/flashcardApi';

type SettingsStatus = 'loading' | 'loaded' | 'error';

interface SettingsState {
  status: SettingsStatus;
  requestRetention: number;
  showIntervals: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  error: string | null;

  loadSettings: () => Promise<void>;
  setRetention: (value: number) => void;
  setShowIntervals: (value: boolean) => void;
  save: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  status: 'loading',
  requestRetention: 0.9,
  showIntervals: true,
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
      });
    } catch (e: any) {
      set({ status: 'error', error: e.message });
    }
  },

  setRetention: (value) => set({ requestRetention: value, saveSuccess: false }),
  setShowIntervals: (value) => set({ showIntervals: value, saveSuccess: false }),

  save: async () => {
    const { requestRetention, showIntervals } = get();
    set({ isSaving: true, saveSuccess: false });
    try {
      await flashcardApi.updateSettings({ requestRetention, showIntervals });
      set({ isSaving: false, saveSuccess: true });
    } catch {
      set({ isSaving: false });
    }
  },
}));
