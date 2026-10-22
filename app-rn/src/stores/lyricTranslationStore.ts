import { create } from 'zustand';
import { preferenceStorage } from '../utils/preferenceStorage';

// 가사 시트에서 바로 켜고 끄는 보기 취향이라 서버 설정(settingsStore)이 아닌 기기에 둔다.
interface LyricTranslationState {
  show: boolean;
  load: () => Promise<void>;
  setShow: (value: boolean) => void;
}

export const useLyricTranslationStore = create<LyricTranslationState>((set) => ({
  show: true,

  load: async () => {
    try {
      set({ show: await preferenceStorage.getShowLyricTranslation() });
    } catch {
      // 못 읽으면 기본값(켜짐)
    }
  },

  setShow: (value) => {
    set({ show: value });
    preferenceStorage.saveShowLyricTranslation(value).catch(() => {});
  },
}));
