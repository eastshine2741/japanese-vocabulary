import { create } from 'zustand';
import { deckApi } from '../api/deckApi';
import { DeckWordItem } from '../types/deck';

type Status = 'loading' | 'success' | 'error';

interface DeckWordListState {
  status: Status;
  words: DeckWordItem[];
  nextCursor: number | null;
  isLoadingMore: boolean;
  error: string | null;
  load: (deckId: number | null) => Promise<void>;
  loadMore: (deckId: number | null) => Promise<void>;
}

export const useDeckWordListStore = create<DeckWordListState>((set, get) => ({
  status: 'loading',
  words: [],
  nextCursor: null,
  isLoadingMore: false,
  error: null,

  load: async (deckId) => {
    set({ status: 'loading', words: [], nextCursor: null, error: null });
    try {
      const res = deckId != null
        ? await deckApi.getDeckWords(deckId)
        : await deckApi.getAllDeckWords();
      set({ status: 'success', words: res.words, nextCursor: res.nextCursor });
    } catch (e: any) {
      set({ status: 'error', error: e.message });
    }
  },

  loadMore: async (deckId) => {
    const { nextCursor, isLoadingMore, words } = get();
    if (nextCursor == null || isLoadingMore) return;
    set({ isLoadingMore: true });
    try {
      const res = deckId != null
        ? await deckApi.getDeckWords(deckId, nextCursor)
        : await deckApi.getAllDeckWords(nextCursor);
      set({
        words: [...words, ...res.words],
        nextCursor: res.nextCursor,
        isLoadingMore: false,
      });
    } catch {
      set({ isLoadingMore: false });
    }
  },
}));
