import { create } from 'zustand';
import { wordApi } from '../api/wordApi';
import { AddWordRequest, WordDetailResponse, WordListItem, sensesFromMeaningText } from '../types/word';
import { Token } from '../types/song';

type AddStatus = 'idle' | 'loading' | 'success' | 'error';
type GetWordStatus = 'idle' | 'loading' | 'found' | 'notFound' | 'error';
type WordListStatus = 'idle' | 'loading' | 'success' | 'error';
type BatchAddStatus = 'idle' | 'loading' | 'success' | 'error';

interface VocabularyState {
  // Add
  addStatus: AddStatus;
  addedId: number | null;

  // Batch add
  batchAddStatus: BatchAddStatus;
  batchSavedCount: number;
  batchSkippedCount: number;

  // Get existing word
  getWordStatus: GetWordStatus;
  existingWord: WordDetailResponse | null;

  // Word list
  wordListStatus: WordListStatus;
  words: WordListItem[];
  nextCursor: number | null;
  isLoadingMore: boolean;

  getWord: (japanese: string) => Promise<void>;
  addWord: (
    token: Token,
    songId: number,
    lyricLine: string,
    koreanLyricLine?: string | null,
    lyricLineIndex?: number | null,
  ) => Promise<void>;
  batchAddWords: (wordRequests: AddWordRequest[]) => Promise<void>;
  resetBatchAdd: () => void;
  loadWords: () => Promise<void>;
  loadMoreWords: () => Promise<void>;
  resetLookup: () => void;
}

export const useVocabularyStore = create<VocabularyState>((set, get) => ({
  addStatus: 'idle',
  addedId: null,
  batchAddStatus: 'idle',
  batchSavedCount: 0,
  batchSkippedCount: 0,
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

  addWord: async (
    token: Token,
    songId: number,
    lyricLine: string,
    koreanLyricLine?: string | null,
    lyricLineIndex?: number | null,
  ) => {
    set({ addStatus: 'loading' });
    try {
      const res = await wordApi.addWord({
        japanese: token.baseForm,
        reading: token.baseFormReading ?? token.reading ?? '',
        // 토큰의 뜻은 쉼표로 이어진 문자열 하나다 — 조각마다 sense 를 만들고, 예문은 첫 조각만 갖는다.
        senses: sensesFromMeaningText(token.koreanText, token.partOfSpeech, [{
          text: lyricLine,
          translation: koreanLyricLine ?? null,
          songId,
          lineIndex: lyricLineIndex ?? null,
        }]),
        songId,
      });
      set({ addStatus: 'success', addedId: res.id });
    } catch {
      set({ addStatus: 'error' });
    }
  },

  batchAddWords: async (wordRequests: AddWordRequest[]) => {
    set({ batchAddStatus: 'loading' });
    try {
      const res = await wordApi.batchAddWords({ words: wordRequests });
      set({ batchAddStatus: 'success', batchSavedCount: res.savedCount, batchSkippedCount: res.skippedCount });
    } catch {
      set({ batchAddStatus: 'error' });
    }
  },

  resetBatchAdd: () =>
    set({ batchAddStatus: 'idle', batchSavedCount: 0, batchSkippedCount: 0 }),

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
