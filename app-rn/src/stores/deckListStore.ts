import { create } from 'zustand';
import { deckApi } from '../api/deckApi';
import { DeckListResponse } from '../types/deck';

type DeckListStatus = 'loading' | 'success' | 'error';

interface DeckListState {
  status: DeckListStatus;
  data: DeckListResponse | null;
  error: string | null;
  load: () => Promise<void>;
}

export const useDeckListStore = create<DeckListState>((set) => ({
  status: 'loading',
  data: null,
  error: null,

  load: async () => {
    set({ status: 'loading', error: null });
    try {
      const data = await deckApi.getDecks();
      set({ status: 'success', data });
    } catch (e: any) {
      set({ status: 'error', error: e.message });
    }
  },
}));
