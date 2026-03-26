import { create } from 'zustand';
import { wordApi } from '../api/wordApi';
import { WordDetailResponse, WordListItem } from '../types/word';
import { Token } from '../types/song';

type AddStatus = 'idle' | 'loading' | 'success' | 'error';
type GetWordStatus = 'idle' | 'loading' | 'found' | 'notFound' | 'error';
type WordListStatus = 'idle' | 'loading' | 'success' | 'error';

interface VocabularyState {
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

  getWord: (japanese: string) => Promise<void>;
  addWord: (token: Token, songId: number, lyricLine: string, koreanLyricLine?: string | null) => Promise<void>;
  loadWords: () => Promise<void>;
  loadMoreWords: () => Promise<void>;
  resetLookup: () => void;
}

export const useVocabularyStore = create<VocabularyState>((set, get) => ({
  addStatus: 'idle',
  addedId: null,
  getWordStatus: 'idle',
  existingWord: null,
  wordListStatus: 'idle',
  words: [],
  nextCursor: null,
  isLoadingMore: false,

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

  addWord: async (token: Token, songId: number, lyricLine: string, koreanLyricLine?: string | null) => {
    set({ addStatus: 'loading' });
    try {
      const res = await wordApi.addWord({
        japanese: token.baseForm,
        reading: token.baseFormReading ?? token.reading ?? '',
        koreanText: token.koreanText ?? '',
        partOfSpeech: token.partOfSpeech,
        songId,
        lyricLine,
        koreanLyricLine: koreanLyricLine ?? undefined,
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
      addStatus: 'idle',
      addedId: null,
      getWordStatus: 'idle',
      existingWord: null,
    }),
}));
