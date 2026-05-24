import { create } from 'zustand';
import { wordApi } from '../api/wordApi';
import { ExampleSentence } from '../types/word';

export type ExamplesState = ExampleSentence[] | 'loading' | 'error';

interface State {
  byId: Record<number, ExamplesState>;
  fetch: (id: number) => Promise<void>;
  reset: () => void;
}

// Per-word example cache. Lifted out of DeckWordListScreen so each row can
// subscribe to its own id via a selector — when one row's fetch completes,
// only that row re-renders, not every row in the list.
export const useWordExamplesStore = create<State>((set, get) => ({
  byId: {},

  fetch: async (id) => {
    if (get().byId[id] !== undefined) return;
    set((s) => ({ byId: { ...s.byId, [id]: 'loading' } }));
    try {
      const detail = await wordApi.getById(id);
      set((s) => ({ byId: { ...s.byId, [id]: detail?.examples ?? [] } }));
    } catch {
      set((s) => ({ byId: { ...s.byId, [id]: 'error' } }));
    }
  },

  reset: () => set({ byId: {} }),
}));
