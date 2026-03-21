import { create } from 'zustand';
import { songApi } from '../api/songApi';
import { SongSearchItem, SongStudyData } from '../types/song';

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';
type AnalyzeStatus = 'idle' | 'loading' | 'success' | 'error';

interface SearchState {
  // Search
  searchStatus: SearchStatus;
  items: SongSearchItem[];
  nextOffset: number | null;
  isLoadingMore: boolean;
  searchError: string | null;

  // Analyze
  analyzeStatus: AnalyzeStatus;
  studyData: SongStudyData | null;
  analyzeError: string | null;

  search: (query: string) => Promise<void>;
  loadMore: () => Promise<void>;
  analyze: (item: SongSearchItem) => Promise<void>;
  loadById: (id: number) => Promise<void>;
  resetAnalyze: () => void;
}

let lastQuery = '';

export const useSearchStore = create<SearchState>((set, get) => ({
  searchStatus: 'idle',
  items: [],
  nextOffset: null,
  isLoadingMore: false,
  searchError: null,

  analyzeStatus: 'idle',
  studyData: null,
  analyzeError: null,

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

  analyze: async (item: SongSearchItem) => {
    set({ analyzeStatus: 'loading', analyzeError: null });
    try {
      const data = await songApi.analyze({
        title: item.title,
        artist: item.artistName,
        durationSeconds: item.durationSeconds,
        artworkUrl: item.thumbnail,
      });
      set({ analyzeStatus: 'success', studyData: data });
    } catch (e: any) {
      set({ analyzeStatus: 'error', analyzeError: e.message });
    }
  },

  loadById: async (id: number) => {
    set({ analyzeStatus: 'loading', analyzeError: null });
    try {
      const data = await songApi.getById(id);
      set({ analyzeStatus: 'success', studyData: data });
    } catch (e: any) {
      set({ analyzeStatus: 'error', analyzeError: e.message });
    }
  },

  resetAnalyze: () => set({ analyzeStatus: 'idle', studyData: null, analyzeError: null }),
}));
