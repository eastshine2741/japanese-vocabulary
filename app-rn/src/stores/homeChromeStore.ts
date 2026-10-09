import { create } from 'zustand';

interface HomeChromeState {
  /** 홈 카드 스택이 접힌 상태(H1) — 바텀 탭 바가 어두운 테마로 바뀐다. */
  isDark: boolean;
  setDark: (v: boolean) => void;
  /** 다른 화면의 '복습 시작' 이 켜 두는 일회성 요청. 홈이 다시 포커스되면 소비한다. */
  pendingImmerse: boolean;
  requestImmerse: () => void;
  /** 요청이 있었으면 true 를 돌려주며 끈다. */
  consumeImmerse: () => boolean;
}

export const useHomeChromeStore = create<HomeChromeState>((set, get) => ({
  isDark: false,
  setDark: (v) => set({ isDark: v }),
  pendingImmerse: false,
  requestImmerse: () => set({ pendingImmerse: true }),
  consumeImmerse: () => {
    if (!get().pendingImmerse) return false;
    set({ pendingImmerse: false });
    return true;
  },
}));
