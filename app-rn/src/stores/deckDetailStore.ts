import { create } from 'zustand';
import { deckApi } from '../api/deckApi';
import { DeckDetailResponse } from '../types/deck';

type DeckDetailStatus = 'loading' | 'success' | 'error';

interface DeckDetailState {
  status: DeckDetailStatus;
  data: DeckDetailResponse | null;
  error: string | null;
  load: (deckId: number | null) => Promise<void>;
}

export const useDeckDetailStore = create<DeckDetailState>((set) => ({
  status: 'loading',
  data: null,
  error: null,

  load: async (deckId) => {
    set({ status: 'loading', error: null });
    try {
      const data = deckId != null
        ? await deckApi.getDeckDetail(deckId)
        : await deckApi.getAllDeckDetail();
      set({ status: 'success', data });
    } catch (e: any) {
      set({ status: 'error', error: e.message });
    }
  },
}));
