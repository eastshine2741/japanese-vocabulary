import { create } from 'zustand';
import { searchHistoryApi } from '../api/searchHistoryApi';

const MAX_HISTORY = 20;

interface SearchHistoryState {
  terms: string[];
  load: () => Promise<void>;
  remove: (term: string) => Promise<void>;
  // Optimistically reflect a just-executed search (server records it too):
  // move the term to the top, keeping a single deduped entry.
  recordLocally: (term: string) => void;
  clear: () => void;
}

export const useSearchHistoryStore = create<SearchHistoryState>((set, get) => ({
  terms: [],

  load: async () => {
    try {
      const terms = await searchHistoryApi.getHistory();
      set({ terms });
    } catch {
      // keep whatever we have; the empty state simply omits the section
    }
  },

  remove: async (term: string) => {
    const prev = get().terms;
    set({ terms: prev.filter(t => t !== term) });
    try {
      await searchHistoryApi.deleteHistory(term);
    } catch {
      set({ terms: prev });
    }
  },

  recordLocally: (term: string) => {
    const t = term.trim();
    if (!t) return;
    set(s => ({ terms: [t, ...s.terms.filter(x => x !== t)].slice(0, MAX_HISTORY) }));
  },

  clear: () => set({ terms: [] }),
}));
