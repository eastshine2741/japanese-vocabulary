import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongSearchItem } from '../types/song';

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

interface SearchState {
  searchStatus: SearchStatus;
  items: SongSearchItem[];
  searchError: string | null;

  search: (query: string) => Promise<void>;
}

export const useSearchStore = create<SearchState>((set) => ({
  searchStatus: 'idle',
  items: [],
  searchError: null,

  search: async (query: string) => {
    set({ searchStatus: 'loading', items: [], searchError: null });
    try {
      const res = await songApi.search(query);
      set({ searchStatus: 'success', items: res.items });
    } catch (e: any) {
      set({ searchStatus: 'error', searchError: e.message });
    }
  },
}));
