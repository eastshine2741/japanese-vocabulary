import { create } from 'zustand';

interface HomeChromeState {
  /** 홈 카드 스택이 접힌 상태(H1) — 바텀 탭 바가 어두운 테마로 바뀐다. */
  isDark: boolean;
  setDark: (v: boolean) => void;
}

export const useHomeChromeStore = create<HomeChromeState>((set) => ({
  isDark: false,
  setDark: (v) => set({ isDark: v }),
}));
