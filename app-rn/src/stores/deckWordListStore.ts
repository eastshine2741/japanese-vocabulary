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

  load: (songId: number | null) => Promise<void>;
  loadMore: (songId: number | null) => Promise<void>;
}

export const useDeckWordListStore = create<DeckWordListState>((set, get) => ({
  status: 'loading',
  words: [],
  nextCursor: null,
  isLoadingMore: false,
  error: null,

  load: async (songId) => {
    set({ status: 'loading', words: [], nextCursor: null, error: null });
    try {
      const res = await deckApi.getDeckWords(songId);
      set({ status: 'success', words: res.words, nextCursor: res.nextCursor });
    } catch (e: any) {
      set({ status: 'error', error: e.message });
    }
  },

  loadMore: async (songId) => {
    const { nextCursor, isLoadingMore, words } = get();
    if (nextCursor == null || isLoadingMore) return;
    set({ isLoadingMore: true });
    try {
      const res = await deckApi.getDeckWords(songId, nextCursor);
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
