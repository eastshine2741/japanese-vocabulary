import { create } from 'zustand';
import { deckApi } from '../api/deckApi';
import { DeckDetailResponse } from '../types/deck';

type DeckDetailStatus = 'loading' | 'success' | 'error';

interface DeckDetailState {
  status: DeckDetailStatus;
  data: DeckDetailResponse | null;
  error: string | null;
  load: (songId: number | null) => Promise<void>;
}

export const useDeckDetailStore = create<DeckDetailState>((set) => ({
  status: 'loading',
  data: null,
  error: null,

  load: async (songId) => {
    set({ status: 'loading', error: null });
    try {
      const data = await deckApi.getDeckDetail(songId);
      set({ status: 'success', data });
    } catch (e: any) {
      set({ status: 'error', error: e.message });
    }
  },
}));
