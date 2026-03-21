import { create } from 'zustand';
import { flashcardApi } from '../api/flashcardApi';
import { FlashcardDTO, FlashcardStatsResponse } from '../types/flashcard';

type ReviewStatus = 'loading' | 'noCards' | 'reviewing' | 'summary' | 'error';

interface ReviewState {
  status: ReviewStatus;
  cards: FlashcardDTO[];
  currentIndex: number;
  isRevealed: boolean;
  totalCount: number;
  stats: FlashcardStatsResponse | null;
  totalReviewed: number;
  ratingCounts: Record<number, number>;
  error: string | null;

  loadDueCards: (songId?: number) => Promise<void>;
  reveal: () => void;
  rate: (rating: number) => Promise<void>;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  status: 'loading',
  cards: [],
  currentIndex: 0,
  isRevealed: false,
  totalCount: 0,
  stats: null,
  totalReviewed: 0,
  ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
  error: null,

  loadDueCards: async (songId?: number) => {
    set({
      status: 'loading',
      cards: [],
      currentIndex: 0,
      isRevealed: false,
      totalReviewed: 0,
      ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
      error: null,
    });
    try {
      const [dueRes, stats] = await Promise.all([
        flashcardApi.getDueCards(songId),
        flashcardApi.getStats(),
      ]);
      if (dueRes.cards.length === 0) {
        set({ status: 'noCards', stats, totalCount: dueRes.totalCount });
      } else {
        set({
          status: 'reviewing',
          cards: dueRes.cards,
          totalCount: dueRes.totalCount,
          stats,
        });
      }
    } catch (e: any) {
      set({ status: 'error', error: e.message });
    }
  },

  reveal: () => set({ isRevealed: true }),

  rate: async (rating: number) => {
    const { cards, currentIndex, totalReviewed, ratingCounts } = get();
    const card = cards[currentIndex];
    if (!card) return;

    try {
      await flashcardApi.review(card.id, { rating });
      const newRatingCounts = { ...ratingCounts, [rating]: ratingCounts[rating] + 1 };
      const newReviewed = totalReviewed + 1;
      const nextIndex = currentIndex + 1;

      if (nextIndex >= cards.length) {
        set({
          status: 'summary',
          totalReviewed: newReviewed,
          ratingCounts: newRatingCounts,
        });
      } else {
        set({
          currentIndex: nextIndex,
          isRevealed: false,
          totalReviewed: newReviewed,
          ratingCounts: newRatingCounts,
        });
      }
    } catch (e: any) {
      set({ status: 'error', error: e.message });
    }
  },
}));
