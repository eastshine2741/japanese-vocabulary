import { create } from 'zustand';
import { flashcardApi } from '../api/flashcardApi';
import type { UserSettingsDTO } from '../types/flashcard';
import type { ReadingDisplay } from '../utils/readingConverter';

type SettingsStatus = 'loading' | 'loaded' | 'error';

interface SettingsState {
  status: SettingsStatus;
  showIntervals: boolean;
  readingDisplay: ReadingDisplay;
  showKoreanPronunciation: boolean;
  showFurigana: boolean;
  dailyGoal: number;
  notificationsEnabled: boolean;
  karaokeNewSongNotifications: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  error: string | null;

  loadSettings: () => Promise<void>;
  setShowIntervals: (value: boolean) => void;
  setReadingDisplay: (value: ReadingDisplay) => void;
  setShowKoreanPronunciation: (value: boolean) => void;
  setShowFurigana: (value: boolean) => void;
  setDailyGoal: (value: number) => void;
  setNotificationsEnabled: (value: boolean) => void;
  toggleKaraokeNewSongNotifications: () => Promise<void>;
  save: () => Promise<void>;
}

function settingsPayload(state: SettingsState): UserSettingsDTO {
  const { showIntervals, readingDisplay, showKoreanPronunciation, showFurigana, dailyGoal, notificationsEnabled, karaokeNewSongNotifications } = state;
  return { showIntervals, readingDisplay, showKoreanPronunciation, showFurigana, dailyGoal, notificationsEnabled, karaokeNewSongNotifications };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  status: 'loading',
  showIntervals: true,
  readingDisplay: 'KOREAN',
  showKoreanPronunciation: true,
  showFurigana: true,
  dailyGoal: 100,
  notificationsEnabled: true,
  karaokeNewSongNotifications: false,
  isSaving: false,
  saveSuccess: false,
  error: null,

  loadSettings: async () => {
    set({ status: 'loading', error: null });
    try {
      const settings = await flashcardApi.getSettings();
      set({
        status: 'loaded',
        showIntervals: settings.showIntervals,
        readingDisplay: settings.readingDisplay,
        showKoreanPronunciation: settings.showKoreanPronunciation,
        showFurigana: settings.showFurigana,
        dailyGoal: settings.dailyGoal,
        notificationsEnabled: settings.notificationsEnabled,
        karaokeNewSongNotifications: settings.karaokeNewSongNotifications,
      });
    } catch (e: any) {
      set({ status: 'error', error: e.message });
    }
  },

  setShowIntervals: (value) => set({ showIntervals: value, saveSuccess: false }),
  setReadingDisplay: (value) => set({ readingDisplay: value, saveSuccess: false }),
  setShowKoreanPronunciation: (value) => set({ showKoreanPronunciation: value, saveSuccess: false }),
  setShowFurigana: (value) => set({ showFurigana: value, saveSuccess: false }),
  setDailyGoal: (value) => set({ dailyGoal: Math.max(1, Math.min(50000, Math.round(value))), saveSuccess: false }),
  setNotificationsEnabled: (value) => set({ notificationsEnabled: value, saveSuccess: false }),

  // PUT /api/settings 는 설정 전체를 덮어쓴다. 읽어 오기 전에는 저장하지 않는다.
  toggleKaraokeNewSongNotifications: async () => {
    if (get().status !== 'loaded') await get().loadSettings();
    if (get().status !== 'loaded') return;

    const next = !get().karaokeNewSongNotifications;
    set({ karaokeNewSongNotifications: next });
    try {
      await flashcardApi.updateSettings(settingsPayload(get()));
    } catch {
      set({ karaokeNewSongNotifications: !next });
    }
  },

  save: async () => {
    set({ isSaving: true, saveSuccess: false });
    try {
      await flashcardApi.updateSettings(settingsPayload(get()));
      set({ isSaving: false, saveSuccess: true });
    } catch {
      set({ isSaving: false });
    }
  },
}));
