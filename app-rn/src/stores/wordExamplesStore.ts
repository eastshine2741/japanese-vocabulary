import { create } from 'zustand';
import { wordApi } from '../api/wordApi';
import { SenseExample, flattenExamples } from '../types/word';

export type ExamplesState = SenseExample[] | 'loading' | 'error';

interface State {
  byId: Record<number, ExamplesState>;
  fetch: (id: number) => Promise<void>;
  reset: () => void;
}

// Per-word example cache; rows select their own id so only that row re-renders on fetch.
export const useWordExamplesStore = create<State>((set, get) => ({
  byId: {},

  fetch: async (id) => {
    if (get().byId[id] !== undefined) return;
    set((s) => ({ byId: { ...s.byId, [id]: 'loading' } }));
    try {
      const detail = await wordApi.getById(id);
      set((s) => ({ byId: { ...s.byId, [id]: flattenExamples(detail?.senses) } }));
    } catch {
      set((s) => ({ byId: { ...s.byId, [id]: 'error' } }));
    }
  },

  reset: () => set({ byId: {} }),
}));
