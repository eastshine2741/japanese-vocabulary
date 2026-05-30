import { create } from 'zustand';
import { deckApi } from '../api/deckApi';
import { SongDeckSummary } from '../types/deck';

type DeckListStatus = 'loading' | 'success' | 'error';

interface DeckListState {
  status: DeckListStatus;
  songDecks: SongDeckSummary[];
  nextCursor: number | null;
  isLoadingMore: boolean;
  error: string | null;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export const useDeckListStore = create<DeckListState>((set, get) => ({
  status: 'loading',
  songDecks: [],
  nextCursor: null,
  isLoadingMore: false,
  error: null,

  load: async () => {
    const hasData = get().songDecks.length > 0;
    if (!hasData) {
      set({ status: 'loading', songDecks: [], nextCursor: null, error: null });
    }
    try {
      const res = await deckApi.getDecks();
      set({ status: 'success', songDecks: res.songDecks, nextCursor: res.nextCursor, error: null });
    } catch (e: any) {
      if (hasData) set({ error: e.message });
      else set({ status: 'error', error: e.message });
    }
  },

  loadMore: async () => {
    const { nextCursor, isLoadingMore, songDecks } = get();
    if (nextCursor == null || isLoadingMore) return;
    set({ isLoadingMore: true });
    try {
      const res = await deckApi.getDecks(nextCursor);
      set({
        songDecks: [...songDecks, ...res.songDecks],
        nextCursor: res.nextCursor,
        isLoadingMore: false,
      });
    } catch {
      set({ isLoadingMore: false });
    }
  },
}));
