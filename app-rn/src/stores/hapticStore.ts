import { create } from 'zustand';
import { preferenceStorage } from '../utils/preferenceStorage';

// 진동은 기기마다 다르게 끄고 싶어 서버 설정(settingsStore)이 아닌 기기에 둔다.
interface HapticState {
  enabled: boolean;
  load: () => Promise<void>;
  setEnabled: (value: boolean) => void;
}

export const useHapticStore = create<HapticState>((set) => ({
  enabled: true,

  load: async () => {
    try {
      set({ enabled: await preferenceStorage.getHapticsEnabled() });
    } catch {
      // 못 읽으면 기본값(켜짐)
    }
  },

  setEnabled: (value) => {
    set({ enabled: value });
    preferenceStorage.saveHapticsEnabled(value).catch(() => {});
  },
}));

export const hapticsEnabled = () => useHapticStore.getState().enabled;
