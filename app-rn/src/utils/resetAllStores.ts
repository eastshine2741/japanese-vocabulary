import { useAuthStore } from '../stores/authStore';
import { useDeckDetailStore } from '../stores/deckDetailStore';
import { useDeckListStore } from '../stores/deckListStore';
import { useDeckWordListStore } from '../stores/deckWordListStore';
import { useHomeStore } from '../stores/homeStore';
import { usePlayerStore } from '../stores/playerStore';
import { useRecommendationStore } from '../stores/recommendationStore';
import { useReviewStore } from '../stores/reviewStore';
import { useSearchHistoryStore } from '../stores/searchHistoryStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useStudyStatsStore } from '../stores/studyStatsStore';
import { useVocabularyStore } from '../stores/vocabularyStore';
import { useWordExamplesStore } from '../stores/wordExamplesStore';

const emptyStatsSlice = () => ({ status: 'idle' as const, data: null, error: null, staleAt: 0 });

export function resetAllStores() {
  useAuthStore.setState({ status: 'idle', error: null, username: null, userName: null });

  useHomeStore.setState({ status: 'loading', songs: [], error: null });
  useRecommendationStore.setState({ status: 'loading', songs: [], error: null });

  useStudyStatsStore.setState({
    home: emptyStatsSlice(),
    profile: emptyStatsSlice(),
    heatmap: emptyStatsSlice(),
  });

  useVocabularyStore.setState({
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
  });

  useDeckListStore.setState({
    status: 'loading',
    songDecks: [],
    nextCursor: null,
    isLoadingMore: false,
    error: null,
  });
  useDeckDetailStore.setState({ status: 'loading', data: null, error: null });
  useDeckWordListStore.setState({
    status: 'loading',
    words: [],
    nextCursor: null,
    isLoadingMore: false,
    error: null,
  });

  useReviewStore.setState({
    status: 'loading',
    cards: [],
    currentIndex: 0,
    isRevealed: false,
    totalCount: 0,
    stats: null,
    totalReviewed: 0,
    ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
    error: null,
  });

  useSettingsStore.setState({
    status: 'loading',
    showIntervals: true,
    readingDisplay: 'KATAKANA',
    showKoreanPronunciation: true,
    showFurigana: true,
    dailyGoal: 10,
    isSaving: false,
    saveSuccess: false,
    error: null,
  });

  usePlayerStore.setState({ status: 'idle', studyData: null, errorCode: null, currentMs: 0, durationMs: 0 });
  useSearchHistoryStore.setState({ terms: [] });
  useWordExamplesStore.setState({ byId: {} });
}
