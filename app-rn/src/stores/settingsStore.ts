import { create } from 'zustand';
import { flashcardApi } from '../api/flashcardApi';
import { requestPermissionForOptIn } from '../services/pushNotifications';
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
  karaokeNewSongNotifications: boolean;
  streakReminderNotifications: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  error: string | null;

  loadSettings: () => Promise<void>;
  setShowIntervals: (value: boolean) => void;
  setReadingDisplay: (value: ReadingDisplay) => void;
  setShowKoreanPronunciation: (value: boolean) => void;
  setShowFurigana: (value: boolean) => void;
  toggleKaraokeNewSongNotifications: () => Promise<void>;
  toggleStreakReminderNotifications: () => Promise<void>;
  toggleShowKoreanPronunciation: () => Promise<void>;
  save: () => Promise<void>;
}

function settingsPayload(state: SettingsState): UserSettingsDTO {
  const {
    showIntervals, readingDisplay, showKoreanPronunciation, showFurigana, dailyGoal,
    karaokeNewSongNotifications, streakReminderNotifications,
  } = state;
  return {
    showIntervals, readingDisplay, showKoreanPronunciation, showFurigana, dailyGoal,
    karaokeNewSongNotifications, streakReminderNotifications,
  };
}

type NotificationKey = 'karaokeNewSongNotifications' | 'streakReminderNotifications';
type ToggleKey = NotificationKey | 'showKoreanPronunciation';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  status: 'loading',
  showIntervals: true,
  readingDisplay: 'KOREAN',
  showKoreanPronunciation: true,
  showFurigana: true,
  dailyGoal: 100,
  karaokeNewSongNotifications: false,
  streakReminderNotifications: true,
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
        karaokeNewSongNotifications: settings.karaokeNewSongNotifications,
        // 이 필드를 모르는 서버 응답이면 서버 기본값과 같은 켜짐으로 둔다.
        streakReminderNotifications: settings.streakReminderNotifications ?? true,
      });
    } catch (e: any) {
      set({ status: 'error', error: e.message });
    }
  },

  setShowIntervals: (value) => set({ showIntervals: value, saveSuccess: false }),
  setReadingDisplay: (value) => set({ readingDisplay: value, saveSuccess: false }),
  setShowKoreanPronunciation: (value) => set({ showKoreanPronunciation: value, saveSuccess: false }),
  setShowFurigana: (value) => set({ showFurigana: value, saveSuccess: false }),

  toggleKaraokeNewSongNotifications: () => toggleSetting('karaokeNewSongNotifications'),
  toggleStreakReminderNotifications: () => toggleSetting('streakReminderNotifications'),
  toggleShowKoreanPronunciation: () => toggleSetting('showKoreanPronunciation'),

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

// PUT /api/settings 는 설정 전체를 덮어쓴다. 읽어 오기 전에는 저장하지 않는다.
async function toggleSetting(key: ToggleKey) {
  const { getState, setState } = useSettingsStore;
  if (getState().status !== 'loaded') await getState().loadSettings();
  if (getState().status !== 'loaded') return;

  const next = !getState()[key];
  setState({ [key]: next });
  if (next && key !== 'showKoreanPronunciation') requestPermissionForOptIn();
  try {
    await flashcardApi.updateSettings(settingsPayload(getState()));
  } catch {
    setState({ [key]: !next });
  }
}
