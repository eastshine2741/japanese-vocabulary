import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongSearchItem } from '../types/song';

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

interface SearchState {
  searchStatus: SearchStatus;
  items: SongSearchItem[];
  nextOffset: number | null;
  isLoadingMore: boolean;
  searchError: string | null;

  search: (query: string) => Promise<void>;
  loadMore: () => Promise<void>;
}

let lastQuery = '';

export const useSearchStore = create<SearchState>((set, get) => ({
  searchStatus: 'idle',
  items: [],
  nextOffset: null,
  isLoadingMore: false,
  searchError: null,

  search: async (query: string) => {
    lastQuery = query;
    set({ searchStatus: 'loading', items: [], nextOffset: null, searchError: null });
    try {
      const res = await songApi.search(query);
      set({ searchStatus: 'success', items: res.items, nextOffset: res.nextOffset });
    } catch (e: any) {
      set({ searchStatus: 'error', searchError: e.message });
    }
  },

  loadMore: async () => {
    const { nextOffset, isLoadingMore, items } = get();
    if (nextOffset == null || isLoadingMore) return;
    set({ isLoadingMore: true });
    try {
      const res = await songApi.search(lastQuery, nextOffset);
      set({
        items: [...items, ...res.items],
        nextOffset: res.nextOffset,
        isLoadingMore: false,
      });
    } catch {
      set({ isLoadingMore: false });
    }
  },
}));
