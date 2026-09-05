import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, GestureResponderHandlers, PanResponder } from 'react-native';
import { deckApi } from '../../api/deckApi';
import { flashcardApi } from '../../api/flashcardApi';
import { songApi } from '../../api/songApi';
import { studyStatsApi } from '../../api/studyStatsApi';
import { useStudyStatsStore } from '../../stores/studyStatsStore';
import { SongDeckSummary } from '../../types/deck';
import { useIsFocused } from '@react-navigation/native';
import { sourceFromDeck, sourceFromRecommendation } from './studySource';
import {
  StudyCard,
  StudySessionProgress,
  StudySource,
  StudyStackStatus,
} from './types';

const SWIPE_OUT_DISTANCE = -420;
const SWIPE_DRAG_LIMIT = -160;
const SWIPE_COMMIT_DISTANCE = -72;

const DUE_PAGE_SIZE = 20;
const DUE_REFRESH_INTERVAL_MS = 30_000;

export interface UseStudyStackOptions {
  /**
   * 'home': due 덱을 스스로 골라 스택을 시작하고 완주 후 다음 곡을 넛지한다.
   * 'source': 주어진 곡 하나만 복습한다.
   */
  mode: 'home' | 'source';
  /** mode 가 'source' 일 때 복습할 곡. mode 가 'home' 이면 무시된다. */
  source?: StudySource | null;
}

export interface StudyStackState {
  status: StudyStackStatus;
  cards: StudyCard[];
  currentCard: StudyCard | null;
  currentIndex: number;
  revealed: boolean;
  selectedRating: number | null;
  saving: boolean;
  isComplete: boolean;
  isError: boolean;
  loadError: string | null;
  reviewError: string | null;
  completedSource: StudySource | null;
  nextDueSource: StudySource | null;
  recommendedSource: StudySource | null;
  /** 무대(아트워크)가 그려야 할 곡. 아무 것도 없으면 null. */
  visibleSource: StudySource | null;
  /** mode 'home' 에서만 채워진다. 실패 시 임의값으로 메우지 않는다. */
  streak: number;
  session: StudySessionProgress;
  translateY: Animated.Value;
  panHandlers: GestureResponderHandlers;
  reveal: () => void;
  selectRating: (rating: number) => void;
  reload: () => void;
  continueDue: () => void;
}

export function useStudyStack({ mode, source }: UseStudyStackOptions): StudyStackState {
  const focused = useIsFocused();
  const activeSourceRef = useRef<StudySource | null>(null);
  const requestVersion = useRef(0);
  const busyRef = useRef(false);
  const [nextDueAt, setNextDueAt] = useState<string | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [status, setStatus] = useState<StudyStackStatus>('loading');
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [completedSource, setCompletedSource] = useState<StudySource | null>(null);
  const [nextDueSource, setNextDueSource] = useState<StudySource | null>(null);
  const [recommendedSource, setRecommendedSource] = useState<StudySource | null>(null);
  const [streak, setStreak] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const translateY = useRef(new Animated.Value(0)).current;

  const sourceRef = useRef<StudySource | null>(source ?? null);
  sourceRef.current = source ?? null;
  const sourceKey = source ? `${source.deckId}:${source.songId}` : null;

  const currentCard = cards[currentIndex] ?? null;
  const currentCardRef = useRef(currentCard);
  currentCardRef.current = currentCard;
  const visibleSource = currentCard?.source ?? nextDueSource ?? recommendedSource ?? completedSource ?? null;
  const isComplete = status === 'ready' && !currentCard;
  const isError = status === 'error';

  const session = useMemo<StudySessionProgress>(() => {
    const queueTotal = reviewedCount + dueCount;
    const position = currentCard ? reviewedCount + 1 : reviewedCount;
    const progress = currentCard
      ? Math.min(1, (reviewedCount + 1) / Math.max(1, currentCard.source.totalCount))
      : completedSource
        ? Math.min(1, reviewedCount / Math.max(1, completedSource.totalCount))
        : 0;
    return {
      reviewedCount,
      position,
      queueTotal,
      progress,
      queueProgress: queueTotal === 0 ? 0 : Math.min(1, position / queueTotal),
    };
  }, [dueCount, completedSource, currentCard, reviewedCount]);

  const showCompletion = useCallback((completed: StudySource | null, dueDecks: SongDeckSummary[]) => {
    const nextDeck = dueDecks
      .filter(deck => deck.deckId !== completed?.deckId && deck.dueCount > 0)
      .sort((a, b) => b.dueCount - a.dueCount)[0];
    setCards([]);
    setCurrentIndex(0);
    setRevealed(false);
    setSelectedRating(null);
    setCompletedSource(completed);
    setNextDueSource(nextDeck ? sourceFromDeck(nextDeck) : null);
    setStatus('ready');
  }, []);

  const loadCardsForSource = useCallback(async (target: StudySource) => {
    const version = ++requestVersion.current;
    activeSourceRef.current = target;
    setNextDueSource(next => next?.deckId === target.deckId ? null : next);
    setNextDueAt(null);
    setDueCount(0);
    setStatus('loading');
    setLoadError(null);
    setReviewError(null);
    setCompletedSource(null);
    setCurrentIndex(0);
    setReviewedCount(0);
    setSelectedRating(null);
    setRevealed(false);
    try {
      if (target.deckId == null) {
        // 아직 이 곡의 덱이 없다 — 복습할 카드가 없는 상태로 완료 화면을 보여준다.
        setCards([]);
        setCompletedSource(target);
        setStatus('ready');
        return;
      }
      // leadWordId 는 최초 진입에만 적용한다 — 이후 refreshDue 는 서버 due 순서를 그대로 따른다.
      const due = target.leadWordId != null
        ? await flashcardApi.getDueCards(target.deckId, DUE_PAGE_SIZE, target.leadWordId)
        : await flashcardApi.getDueCards(target.deckId, DUE_PAGE_SIZE);
      if (version !== requestVersion.current) return;
      setNextDueAt(due.nextDueAt);
      setDueCount(due.totalCount);
      if (due.cards.length > 0) {
        setCards(due.cards.map(card => ({ ...card, source: target })));
        setStatus('ready');
        return;
      }
      setCards([]);
      setCompletedSource(target);
      setStatus('ready');
    } catch (e: any) {
      if (version !== requestVersion.current) return;
      // 실제 due API 실패를 완료 화면으로 위장하지 않는다.
      setLoadError(e.message ?? '복습 카드를 불러오지 못했어요');
      setCards([]);
      setCompletedSource(null);
      setStatus('error');
    }
  }, []);

  // 매번 서버 큐의 맨 앞을 다시 읽는다. 이미 평가한 카드도 다시 due 가 될 수 있다.
  const refreshDue = useCallback(async () => {
    const target = activeSourceRef.current;
    if (target?.deckId == null) return;
    const version = ++requestVersion.current;
    try {
      const due = await flashcardApi.getDueCards(target.deckId, DUE_PAGE_SIZE);
      if (version !== requestVersion.current) return;
      setCards(due.cards.map(card => ({ ...card, source: target })));
      setCurrentIndex(0);
      if (currentCardRef.current?.id !== due.cards[0]?.id) {
        setRevealed(false);
        setSelectedRating(null);
      }
      setDueCount(due.totalCount);
      setNextDueAt(due.nextDueAt);
      setCompletedSource(due.cards.length === 0 ? target : null);
      setLoadError(null);
      setStatus('ready');
    } catch (e: any) {
      if (version !== requestVersion.current) return;
      setLoadError(e.message ?? '복습 카드를 불러오지 못했어요');
      setCards([]);
      setStatus('error');
    } finally {
      if (version === requestVersion.current) setRefreshTick(tick => tick + 1);
    }
  }, []);

  const loadHomeStack = useCallback(async () => {
    const version = ++requestVersion.current;
    activeSourceRef.current = null;
    setDueCount(0);
    setReviewedCount(0);
    setNextDueAt(null);
    setStatus('loading');
    setLoadError(null);
    try {
      const [deckRes, homeStats, recommendations] = await Promise.all([
        deckApi.getDecks(),
        studyStatsApi.getHome(),
        songApi.getRecommendations(),
      ]);
      if (version !== requestVersion.current) return;
      setRecommendedSource(recommendations[0] ? sourceFromRecommendation(recommendations[0]) : null);
      setStreak(homeStats.currentStreak);

      const dueDecks = deckRes.songDecks.filter(deck => deck.dueCount > 0);
      const firstDeck = [...dueDecks].sort((a, b) => b.dueCount - a.dueCount)[0];
      if (firstDeck) {
        const firstSource = sourceFromDeck(firstDeck);
        const followingDeck = dueDecks
          .filter(deck => deck.deckId !== firstDeck.deckId)
          .sort((a, b) => b.dueCount - a.dueCount)[0];
        setNextDueSource(followingDeck ? sourceFromDeck(followingDeck) : null);
        await loadCardsForSource(firstSource);
      } else {
        showCompletion(null, []);
      }
    } catch (e: any) {
      if (version !== requestVersion.current) return;
      // streak 은 실제 API 가 있는 값이라 실패 시 임의 숫자를 채우지 않는다.
      setLoadError(e.message ?? '홈 데이터를 불러오지 못했어요');
      setCards([]);
      setCompletedSource(null);
      setNextDueSource(null);
      setStatus('error');
    }
  }, [loadCardsForSource, showCompletion]);

  const reload = useCallback(() => {
    if (mode === 'home') {
      loadHomeStack();
      return;
    }
    const target = sourceRef.current;
    if (!target) {
      // 아직 곡이 안 정해진 것은 실패가 아니다 — 로딩으로 둔다.
      setCards([]);
      setCompletedSource(null);
      setStatus('loading');
      return;
    }
    loadCardsForSource(target);
  }, [loadCardsForSource, loadHomeStack, mode]);

  useEffect(() => {
    reload();
    return () => {
      requestVersion.current += 1;
      activeSourceRef.current = null;
    };
    // sourceKey 가 바뀌면 다른 곡이므로 스택을 다시 연다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, sourceKey]);

  // 완주 카드가 다음 due 곡을 넛지할 수 있게 source 모드에서도 덱을 훑는다.
  // 실패해도 이번 곡 복습을 막지 않는다 — 넛지가 빠질 뿐이다.
  useEffect(() => {
    if (mode !== 'source') return;
    const target = sourceRef.current;
    if (!target) return;
    let cancelled = false;
    deckApi.getDecks()
      .then(res => {
        if (cancelled) return;
        const nextDeck = res.songDecks
          .filter(deck => deck.dueCount > 0 && deck.deckId !== target.deckId)
          .sort((a, b) => b.dueCount - a.dueCount)[0];
        setNextDueSource(nextDeck ? sourceFromDeck(nextDeck) : null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sourceKey]);

  const reveal = useCallback(() => setRevealed(true), []);

  const advanceAfterReview = useCallback(async () => {
    if (!currentCard || selectedRating == null || busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    const version = ++requestVersion.current;
    try {
      const result = await flashcardApi.review(currentCard.id, { rating: selectedRating });
      useStudyStatsStore.getState().invalidate();
      if (version !== requestVersion.current) return;
      setNextDueAt(result.due);
      setReviewError(null);
      setReviewedCount(count => count + 1);
      setSelectedRating(null);
      setRevealed(false);
      await new Promise<void>(resolve => {
        Animated.timing(translateY, {
          toValue: SWIPE_OUT_DISTANCE,
          duration: 180,
          useNativeDriver: true,
        }).start(() => resolve());
      });
      if (version !== requestVersion.current) return;
      // 저장 성공 뒤 조회만 실패한 경우 평가를 중복 제출하지 않는다.
      await refreshDue();
    } catch (e: any) {
      if (version === requestVersion.current) {
        setReviewError(e.message ?? '복습 저장에 실패했어요. 다시 시도해 주세요');
      }
    } finally {
      translateY.setValue(0);
      busyRef.current = false;
      setSaving(false);
    }
  }, [currentCard, refreshDue, selectedRating, translateY]);

  // 버퍼가 남아 있어도 미래 due 도착, 앱 복귀, 화면 재진입 시 다시 조회한다.
  useEffect(() => {
    if (!focused || status === 'loading' || saving) return;
    const refresh = () => {
      if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive' && !busyRef.current) {
        if (activeSourceRef.current == null && mode === 'home') void loadHomeStack();
        else void refreshDue();
      }
    };
    const dueDelay = nextDueAt == null ? DUE_REFRESH_INTERVAL_MS : Date.parse(nextDueAt) - Date.now();
    const timer = setTimeout(refresh, Math.max(1000, Math.min(DUE_REFRESH_INTERVAL_MS, dueDelay || 1000)));
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [focused, loadHomeStack, mode, nextDueAt, refreshDue, refreshTick, saving, status]);

  const wasFocused = useRef(focused);
  useEffect(() => {
    if (focused && !wasFocused.current && !busyRef.current) {
      if (activeSourceRef.current == null && mode === 'home') void loadHomeStack();
      else void refreshDue();
    }
    wasFocused.current = focused;
  }, [focused, loadHomeStack, mode, refreshDue]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => revealed && selectedRating != null && Math.abs(gesture.dy) > 8,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          translateY.setValue(Math.max(gesture.dy, SWIPE_DRAG_LIMIT));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < SWIPE_COMMIT_DISTANCE) {
          advanceAfterReview();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
    [advanceAfterReview, revealed, selectedRating, translateY],
  );

  const continueDue = useCallback(() => {
    if (!nextDueSource) return;
    loadCardsForSource(nextDueSource);
  }, [loadCardsForSource, nextDueSource]);

  return {
    status,
    cards,
    currentCard,
    currentIndex,
    revealed,
    selectedRating,
    saving,
    isComplete,
    isError,
    loadError,
    reviewError,
    completedSource,
    nextDueSource,
    recommendedSource,
    visibleSource,
    streak,
    session,
    translateY,
    panHandlers: panResponder.panHandlers,
    reveal,
    selectRating: setSelectedRating,
    reload,
    continueDue,
  };
}
