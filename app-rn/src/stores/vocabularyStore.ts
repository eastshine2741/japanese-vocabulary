import { create } from 'zustand';
import { wordApi } from '../api/wordApi';
import { WordDefinitionDTO, WordDetailResponse, WordListItem } from '../types/word';

type LookupStatus = 'idle' | 'loading' | 'success' | 'error';
type AddStatus = 'idle' | 'loading' | 'success' | 'error';
type GetWordStatus = 'idle' | 'loading' | 'found' | 'notFound' | 'error';
type WordListStatus = 'idle' | 'loading' | 'success' | 'error';

interface VocabularyState {
  // Lookup
  lookupStatus: LookupStatus;
  definition: WordDefinitionDTO | null;
  lookupError: string | null;

  // Add
  addStatus: AddStatus;
  addedId: number | null;

  // Get existing word
  getWordStatus: GetWordStatus;
  existingWord: WordDetailResponse | null;

  // Word list
  wordListStatus: WordListStatus;
  words: WordListItem[];
  nextCursor: number | null;
  isLoadingMore: boolean;

  lookupWord: (word: string) => Promise<void>;
  getWord: (japanese: string) => Promise<void>;
  addWord: (definition: WordDefinitionDTO, songId: number, lyricLine: string) => Promise<void>;
  loadWords: () => Promise<void>;
  loadMoreWords: () => Promise<void>;
  resetLookup: () => void;
}

export const useVocabularyStore = create<VocabularyState>((set, get) => ({
  lookupStatus: 'idle',
  definition: null,
  lookupError: null,
  addStatus: 'idle',
  addedId: null,
  getWordStatus: 'idle',
  existingWord: null,
  wordListStatus: 'idle',
  words: [],
  nextCursor: null,
  isLoadingMore: false,

  lookupWord: async (word: string) => {
    set({ lookupStatus: 'loading', lookupError: null, definition: null });
    try {
      const def = await wordApi.lookup(word);
      set({ lookupStatus: 'success', definition: def });
    } catch (e: any) {
      set({ lookupStatus: 'error', lookupError: e.message });
    }
  },

  getWord: async (japanese: string) => {
    set({ getWordStatus: 'loading', existingWord: null });
    try {
      const word = await wordApi.getByText(japanese);
      if (word) {
        set({ getWordStatus: 'found', existingWord: word });
      } else {
        set({ getWordStatus: 'notFound' });
      }
    } catch {
      set({ getWordStatus: 'error' });
    }
  },

  addWord: async (definition, songId, lyricLine) => {
    set({ addStatus: 'loading' });
    try {
      const res = await wordApi.addWord({
        japanese: definition.japanese,
        reading: definition.reading,
        koreanText: definition.meanings.join(', '),
        songId,
        lyricLine,
      });
      set({ addStatus: 'success', addedId: res.id });
    } catch {
      set({ addStatus: 'error' });
    }
  },

  loadWords: async () => {
    set({ wordListStatus: 'loading', words: [], nextCursor: null });
    try {
      const res = await wordApi.getWords();
      set({ wordListStatus: 'success', words: res.words, nextCursor: res.nextCursor });
    } catch {
      set({ wordListStatus: 'error' });
    }
  },

  loadMoreWords: async () => {
    const { nextCursor, isLoadingMore, words } = get();
    if (nextCursor == null || isLoadingMore) return;
    set({ isLoadingMore: true });
    try {
      const res = await wordApi.getWords(nextCursor);
      set({
        words: [...words, ...res.words],
        nextCursor: res.nextCursor,
        isLoadingMore: false,
      });
    } catch {
      set({ isLoadingMore: false });
    }
  },

  resetLookup: () =>
    set({
      lookupStatus: 'idle',
      definition: null,
      lookupError: null,
      addStatus: 'idle',
      addedId: null,
      getWordStatus: 'idle',
      existingWord: null,
    }),
}));
