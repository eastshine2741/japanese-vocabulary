import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, GestureResponderHandlers, PanResponder } from 'react-native';
import { deckApi } from '../../api/deckApi';
import { flashcardApi } from '../../api/flashcardApi';
import { songApi } from '../../api/songApi';
import { trackCardRate, trackCardReveal, trackReviewComplete } from '../../services/analytics';
import { studyStatsApi } from '../../api/studyStatsApi';
import { wordApi } from '../../api/wordApi';
import { useStreakStore } from '../../stores/streakStore';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import { useStudyStatsStore } from '../../stores/studyStatsStore';
import { SongDeckSummary } from '../../types/deck';
import { FlashcardMemory } from '../../types/flashcard';
import { RewardCardRevealDto } from '../../types/rewardCard';
import { SongStudyCardDto, SongWordTierKey } from '../../types/song';
import { estimateSecondsPerCard, MAX_CARD_GAP_SECONDS } from './sessionEta';
import { hapticCardDone, hapticRatingSelect, hapticReveal, hapticSessionComplete } from './studyHaptics';
import { sourceFromDeck, sourceFromRecent, sourceFromRecommendation } from './studySource';
import {
  accumulateMemoryDiff,
  EMPTY_MEMORY_DIFF,
  isUnsavedCard,
  StudyCard,
  StudyMemoryDiff,
  StudySessionProgress,
  StudySource,
  StudyStackStatus,
} from './types';

/** 카드가 완전히 사라지는(=다음 카드가 완전히 드러나는) 지점. 드래그도 이 지점까지 막힘없이 따라간다. */
export const SWIPE_OUT_DISTANCE = -420;
const SWIPE_COMMIT_DISTANCE = -72;
/** rating 선택 후 머무는 시간. pill 합침 160ms 를 빼고도 문구가 읽히도록 남겨 둔다. */
export const RATING_HOLD_MS = 900;

const DUE_PAGE_SIZE = 20;
const LINE_TIER_KEYS: readonly SongWordTierKey[] = ['CHORUS', 'SINGALONG', 'FULL'];
/** 로컬 버퍼에 이 개수 이하로 남으면 다음 페이지를 미리 불러온다. */
const PREFETCH_REMAINING_THRESHOLD = 5;

/** 안 담은 단어는 flashcard 가 없다 — 세션 안에서만 겹치지 않는 음수 id 를 준다. */
function toStudyCards(cards: SongStudyCardDto[], source: StudySource): StudyCard[] {
  return cards.map(({ inSongDeck, ...card }, index) => {
    const id = card.id ?? -(index + 1);
    return { ...card, id, wordId: card.wordId ?? id, saveOnReview: !inSongDeck, source };
  });
}

interface CardReviewResult {
  /** 리뷰된 실제 flashcard id. 안 담은 단어였다면 방금 생긴 카드다. */
  id: number;
  memory: FlashcardMemory;
  rewardCards?: RewardCardRevealDto[];
  /** 안 담은 단어를 담으면서 곡 단어장이 생겼을 수 있다. */
  deckId: number | null;
}

async function reviewCard(card: StudyCard, rating: number): Promise<CardReviewResult> {
  if (!card.saveOnReview) {
    const result = await flashcardApi.review(card.id, { rating });
    return { ...result, deckId: null };
  }
  if (card.source.songId == null) throw new Error('곡 정보를 확인하지 못했어요');
  return songApi.reviewSongWord(card.source.songId, card.japanese, rating);
}

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
  /** 완주한 곡에 아직 안 배운 단어가 남았을 때 그 곡. 다음 due 곡이 없을 때만 찾는다. */
  songNewSource: StudySource | null;
  /** songNewSource 를 찾는 중. 그동안 완주 카드 CTA 가 추천곡·검색으로 먼저 떴다가 바뀌지 않게 가린다. */
  songNewPending: boolean;
  recommendedSource: StudySource | null;
  /** mode 'home' 에서만 채워진다. 덱 스트립에 그릴 목록 — 곡 덱이 있으면 due 많은 순 덱 목록, 없으면 추천곡 목록. */
  deckStripItems: StudySource[];
  /**
   * mode 'home' 에서만 채워진다. 지금 고른 곡이 아니라 **전체** 덱에서 오늘 아직 남은 due 장수.
   * 홈 헤더와 오늘의 복습 스케줄 화면이 같은 숫자를 보여야 해서 세션 큐가 아니라 이 값을 쓴다.
   */
  dueTodayCount: number;
  /** 덱 스트립에서 현재 강조돼야 할 항목. `selectSource` 로 바뀐다. */
  selectedSource: StudySource | null;
  /** 무대(아트워크)가 그려야 할 곡. 아무 것도 없으면 null. */
  visibleSource: StudySource | null;
  session: StudySessionProgress;
  /** 이번 세션에서 기억 칸이 바뀐 단어 수. 완주 카드의 diff. */
  memoryDiff: StudyMemoryDiff;
  translateY: Animated.Value;
  revealProgress: Animated.Value;
  panHandlers: GestureResponderHandlers;
  reveal: () => void;
  selectRating: (rating: number) => void;
  /** 홀드 중 pill 탭. 홀드를 기다리지 않고 바로 넘긴다. */
  commitRating: () => void;
  reload: () => void;
  /** 단어 편집 화면에서 돌아왔을 때 현재 카드의 읽기·뜻만 다시 받는다. 큐·진행도는 건드리지 않는다. */
  refreshCurrentCard: () => Promise<void>;
  continueDue: () => void;
  /** 완주 카드의 같은 곡 새 단어 CTA. 그 곡의 세션 카드를 다시 연다. */
  startSongNew: () => void;
  /** 덱 스트립에서 곡을 골랐을 때. 덱이 있으면 그 덱을 열고, 없으면(추천곡) 미리보기 카드를 띄운다. */
  selectSource: (target: StudySource) => void;
  /** 완주 카드의 추천곡 CTA. 그 자리에서 추천곡 미리보기 카드를 띄워 학습을 이어간다. */
  startRecommended: () => void;
  /** 곡 덱을 지운 뒤. 지금 보던 곡이면 홈을 처음부터 다시 열고, 아니면 스트립에서만 빼고 오늘 due 를 다시 센다. */
  removeDeck: (deckId: number) => void;
}

export function useStudyStack({ mode, source }: UseStudyStackOptions): StudyStackState {
  const activeSourceRef = useRef<StudySource | null>(null);
  const requestVersion = useRef(0);
  // 홈의 칩·넛지 값은 카드 로드(requestVersion 을 올린다)보다 늦게 올 수 있어 홈 로드 단위로 따로 센다.
  const homeLoadVersion = useRef(0);
  const busyRef = useRef(false);
  /** 단계 학습처럼 처음 받은 카드가 전부인 세션인지. 이때는 서버 due 큐로 이어 붙이지 않는다. */
  const fixedQueueRef = useRef(false);
  /** 곡 세션 카드(`study-cards`)처럼 서버가 카드를 한 번에 다 준 세션. 다 보면 곡 덱 due 로 이어가되 미리 받지 않는다. */
  const wholeListRef = useRef(false);
  const [dueCount, setDueCount] = useState(0);
  const [status, setStatus] = useState<StudyStackStatus>('loading');
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [completedSource, setCompletedSource] = useState<StudySource | null>(null);
  const [nextDueSource, setNextDueSource] = useState<StudySource | null>(null);
  const [recommendedSource, setRecommendedSource] = useState<StudySource | null>(null);
  const [songNewSource, setSongNewSource] = useState<StudySource | null>(null);
  const [songNewPending, setSongNewPending] = useState(false);
  const [deckStripItems, setDeckStripItems] = useState<StudySource[]>([]);
  const [dueTodayCount, setDueTodayCount] = useState(0);
  const [selectedSource, setSelectedSource] = useState<StudySource | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  /** m: 이번 복습 세션 시작 시점의 due 카드 수. 세션 도중엔 바뀌지 않는다. */
  const [sessionDueTotal, setSessionDueTotal] = useState(0);
  /** n: 이번 세션에서 리뷰를 마친 distinct 카드 수. 페이지네이션으로 같은 카드를 다시 봐도 한 번만 센다. */
  const [distinctReviewedCount, setDistinctReviewedCount] = useState(0);
  const reviewedIdsRef = useRef<Set<number>>(new Set());
  /** rating 이 저장된 시각 사이 간격(초). 세션을 다시 열어도 같은 유저라 비우지 않는다. */
  const cardGapsRef = useRef<number[]>([]);
  const lastReviewedAtRef = useRef<number | null>(null);
  /** 이번 세션에서 기억 칸이 실제로 바뀐 단어 수. 완주 카드가 보여준다. */
  const [memoryDiff, setMemoryDiff] = useState<StudyMemoryDiff>(EMPTY_MEMORY_DIFF);
  // 카드마다 새 인스턴스로 교체한다. setValue(0) 리셋은 React 렌더와 같은 프레임에 반영된다는 보장이 없어
  // 새 카드가 화면 밖에 남거나 옛 레이어가 잠깐 불투명하게 노출된다.
  const [translateY, setTranslateY] = useState<Animated.Value>(() => new Animated.Value(0));
  const [revealProgress, setRevealProgress] = useState<Animated.Value>(() => new Animated.Value(0));

  const sourceRef = useRef<StudySource | null>(source ?? null);
  sourceRef.current = source ?? null;
  const sourceKey = source
    ? `${source.deckId}:${source.songId}:${source.tierKey ?? ''}:${source.lineWords?.join(',') ?? ''}`
    : null;

  const currentCard = cards[currentIndex] ?? null;
  const currentCardRef = useRef(currentCard);
  currentCardRef.current = currentCard;
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const dueCountRef = useRef(dueCount);
  dueCountRef.current = dueCount;
  const selectedSourceRef = useRef(selectedSource);
  selectedSourceRef.current = selectedSource;
  const selectedRatingRef = useRef(selectedRating);
  selectedRatingRef.current = selectedRating;
  /** rating 선택 뒤 자동으로 다음 카드로 넘어가는 홀드 타이머. 취소·스와이프·카드 교체 때 지운다. */
  const ratingHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearRatingHold = useCallback(() => {
    if (ratingHoldTimerRef.current == null) return;
    clearTimeout(ratingHoldTimerRef.current);
    ratingHoldTimerRef.current = null;
  }, []);
  useEffect(() => clearRatingHold, [clearRatingHold]);
  const reviewedCountRef = useRef(reviewedCount);
  reviewedCountRef.current = reviewedCount;
  const prefetchingRef = useRef(false);
  const visibleSource = currentCard?.source ?? nextDueSource ?? recommendedSource ?? completedSource ?? null;
  const isComplete = status === 'ready' && !currentCard;
  const isError = status === 'error';

  const session = useMemo<StudySessionProgress>(() => {
    const queueTotal = sessionDueTotal;
    const position = distinctReviewedCount;
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
      secondsPerCard: estimateSecondsPerCard(cardGapsRef.current),
    };
  }, [sessionDueTotal, distinctReviewedCount, completedSource, currentCard, reviewedCount]);

  // 첫 진입부터 due 가 없어 바로 뜬 완주 카드는 복습을 마친 게 아니라 세지 않는다.
  useEffect(() => {
    if (!isComplete || reviewedCountRef.current === 0) return;
    hapticSessionComplete();
    trackReviewComplete({
      mode,
      ...(completedSource?.songId != null && { song_id: completedSource.songId }),
      ...(completedSource?.deckId != null && { deck_id: completedSource.deckId }),
      ...(completedSource?.tierKey != null && { tier_key: completedSource.tierKey }),
      reviewed: reviewedCountRef.current,
    });
    // 완주로 넘어가는 순간 한 번만 남긴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  const showCompletion = useCallback((completed: StudySource | null, dueDecks: SongDeckSummary[]) => {
    const nextDeck = dueDecks
      .filter(deck => deck.deckId !== completed?.deckId && deck.dueCount > 0)
      .sort((a, b) => b.dueCount - a.dueCount)[0];
    setCards([]);
    setCurrentIndex(0);
    setRevealed(false);
    setRevealProgress(new Animated.Value(0));
    clearRatingHold();
    setSelectedRating(null);
    setCompletedSource(completed);
    setNextDueSource(nextDeck ? sourceFromDeck(nextDeck) : null);
    setStatus('ready');
  }, [clearRatingHold]);

  // 완료 화면에 들어갈 때마다 다음 due 덱을 다시 고른다(리뷰가 진행되면 진입 시 값이 낡는다). 실패하면 이전 값을 둔다.
  const refreshNextDue = useCallback(async (completed: StudySource | null, version: number) => {
    try {
      const res = await deckApi.getDecks();
      if (version !== requestVersion.current) return;
      const nextDeck = res.songDecks
        .filter(deck => deck.songId != null && deck.dueCount > 0 && deck.deckId !== completed?.deckId)
        .sort((a, b) => b.dueCount - a.dueCount)[0];
      setNextDueSource(nextDeck ? sourceFromDeck(nextDeck) : null);
    } catch {
      // 넛지가 빠질 뿐 완료 화면은 그대로 보여준다.
    }
  }, []);

  /** 서버가 한 번에 준 곡 세션 카드로 스택을 시작한다. 비어 있으면 완료 화면이다. */
  const startWholeList = useCallback((
    target: StudySource,
    deckId: number | null,
    sessionCards: SongStudyCardDto[],
    totalCount: number,
  ) => {
    const sessionSource: StudySource = { ...target, deckId: deckId ?? target.deckId, totalCount, previewWord: null };
    activeSourceRef.current = sessionSource;
    fixedQueueRef.current = false;
    wholeListRef.current = true;
    setDueCount(sessionCards.length);
    setSessionDueTotal(totalCount);
    setCards(toStudyCards(sessionCards, sessionSource));
    setCurrentIndex(0);
    setCompletedSource(sessionCards.length === 0 ? sessionSource : null);
    setRevealed(false);
    setRevealProgress(new Animated.Value(0));
    clearRatingHold();
    setSelectedRating(null);
    setTranslateY(new Animated.Value(0));
    setStatus('ready');
  }, [clearRatingHold]);

  const loadCardsForSource = useCallback(async (target: StudySource) => {
    const version = ++requestVersion.current;
    activeSourceRef.current = target;
    setSelectedSource(target);
    setNextDueSource(next => next?.deckId === target.deckId ? null : next);
    setDueCount(0);
    setStatus('loading');
    setLoadError(null);
    setReviewError(null);
    setCompletedSource(null);
    setCurrentIndex(0);
    setTranslateY(new Animated.Value(0));
    setRevealProgress(new Animated.Value(0));
    setReviewedCount(0);
    setSessionDueTotal(0);
    reviewedIdsRef.current = new Set();
    setDistinctReviewedCount(0);
    setMemoryDiff(EMPTY_MEMORY_DIFF);
    clearRatingHold();
    setSelectedRating(null);
    setRevealed(false);
    fixedQueueRef.current = false;
    wholeListRef.current = false;
    try {
      if (target.lineWords != null && target.songId != null) {
        // 줄 단어는 여러 단계에 걸친다. 세 단계의 due 카드를 모아 이 줄 단어만 줄 안 등장순으로 남긴다.
        // 처음 보는 단어만 묻는다 — 앞 줄에서 본 단어의 복습은 홈 스택이 맡는다.
        const songId = target.songId;
        const results = await Promise.all(LINE_TIER_KEYS.map(key => songApi.getWordTierCards(songId, key)));
        if (version !== requestVersion.current) return;
        const order = new Map(target.lineWords.map((key, i) => [key, i]));
        const lineCards = results
          .flatMap(result => result.cards)
          .filter(card => order.has(card.japanese) && card.memory === 'REMAINING')
          .filter((card, i, all) => all.findIndex(other => other.japanese === card.japanese) === i)
          .sort((a, b) => order.get(a.japanese)! - order.get(b.japanese)!);
        const deckId = results.find(result => result.deckId != null)?.deckId ?? target.deckId;
        const lineSource: StudySource = { ...target, deckId, totalCount: lineCards.length };
        activeSourceRef.current = lineSource;
        fixedQueueRef.current = true;
        setDueCount(lineCards.length);
        setSessionDueTotal(lineCards.length);
        setCards(toStudyCards(lineCards, lineSource));
        setCompletedSource(lineCards.length === 0 ? lineSource : null);
        setStatus('ready');
        return;
      }
      if (target.tierKey != null && target.songId != null) {
        // 단계 학습: 서버가 그 단계의 due 단어를 한 번에 준다. 이 목록이 세션의 전부이고, 단어는 rating 때 한 장씩 담긴다.
        const result = await songApi.getWordTierCards(target.songId, target.tierKey);
        if (version !== requestVersion.current) return;
        const tierSource: StudySource = { ...target, deckId: result.deckId ?? target.deckId, totalCount: result.totalCount };
        activeSourceRef.current = tierSource;
        fixedQueueRef.current = true;
        setDueCount(result.cards.length);
        setSessionDueTotal(result.totalCount);
        if (result.cards.length > 0) {
          setCards(toStudyCards(result.cards, tierSource));
        } else {
          setCards([]);
          setCompletedSource(tierSource);
        }
        setStatus('ready');
        return;
      }
      // 곡 상세에서 누른 단어로 열었다면 곡 덱 첫 카드가 그 단어일 때만 곡 덱으로 연다. 안 담긴 단어는 곡 덱에 없고,
      // 서버는 곡 덱에 없는 lead 를 무시한다. leadWordId 는 최초 진입에만 적용한다 — 이후 refreshDue 는 서버 due 순서를 따른다.
      const deckId = target.previewWord != null && target.leadWordId == null ? null : target.deckId;
      const due = deckId == null
        ? null
        : target.leadWordId != null
          ? await flashcardApi.getDueCards(deckId, DUE_PAGE_SIZE, target.leadWordId)
          : await flashcardApi.getDueCards(deckId, DUE_PAGE_SIZE);
      if (version !== requestVersion.current) return;
      const tappedLeads = due != null && due.cards[0]?.wordId === target.leadWordId;
      if (target.previewWord && !tappedLeads && target.songId != null) {
        // 그 단어를 맨 앞에 둔 곡 세션을 연다. 아무것도 담지 않고, 단어는 rating 때 한 장씩 담긴다.
        const result = await songApi.getStudyCards(target.songId, target.previewWord.japanese);
        if (version !== requestVersion.current) return;
        startWholeList(target, result.deckId, result.cards, result.totalCount);
        return;
      }
      if (due == null && target.songId != null) {
        // 아직 이 곡의 덱이 없다 — 담지 않고 곡 세션을 연다. 단어는 rating 때 한 장씩 담긴다.
        const result = await songApi.getStudyCards(target.songId);
        if (version !== requestVersion.current) return;
        startWholeList(target, result.deckId, result.cards, result.totalCount);
        return;
      }
      if (due == null) {
        setCards([]);
        setCompletedSource(target);
        setStatus('ready');
        return;
      }
      setDueCount(due.totalCount);
      setSessionDueTotal(due.totalCount);
      if (due.cards.length > 0) {
        setCards(due.cards.map(card => ({ ...card, source: target })));
        setStatus('ready');
        return;
      }
      await refreshNextDue(target, version);
      if (version !== requestVersion.current) return;
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
  }, [clearRatingHold, refreshNextDue, startWholeList]);

  // 서버 큐의 맨 앞을 다시 읽는다. 이미 평가한 카드도 다시 due 가 될 수 있다.
  // 로컬 버퍼가 바닥났을 때의 폴백으로만 쓰인다 — 매 리뷰마다 부르지 않는다.
  const refreshDue = useCallback(async () => {
    const target = activeSourceRef.current;
    if (target == null) return;
    const version = ++requestVersion.current;
    if (fixedQueueRef.current || target.deckId == null) {
      // 단계 학습은 처음 받은 카드가 전부다 — 서버 due 큐로 이어가지 않고 완료 화면으로 간다. 곡 덱이 아직 없어도 그렇다.
      await refreshNextDue(target, version);
      if (version !== requestVersion.current) return;
      setCards([]);
      setCurrentIndex(0);
      setRevealed(false);
      setRevealProgress(new Animated.Value(0));
      clearRatingHold();
      setSelectedRating(null);
      setTranslateY(new Animated.Value(0));
      setCompletedSource(target);
      setStatus('ready');
      return;
    }
    const deckId = target.deckId;
    try {
      const due = await flashcardApi.getDueCards(deckId, DUE_PAGE_SIZE);
      if (version !== requestVersion.current) return;
      if (due.cards.length === 0) {
        await refreshNextDue(target, version);
        if (version !== requestVersion.current) return;
      }
      setCards(due.cards.map(card => ({ ...card, source: target })));
      setCurrentIndex(0);
      if (currentCardRef.current?.id !== due.cards[0]?.id) {
        setRevealed(false);
        setRevealProgress(new Animated.Value(0));
        clearRatingHold();
        setSelectedRating(null);
        setTranslateY(new Animated.Value(0));
      }
      setDueCount(due.totalCount);
      setCompletedSource(due.cards.length === 0 ? target : null);
      setLoadError(null);
      setStatus('ready');
    } catch (e: any) {
      if (version !== requestVersion.current) return;
      setLoadError(e.message ?? '복습 카드를 불러오지 못했어요');
      setCards([]);
      setStatus('error');
    }
  }, [clearRatingHold, refreshNextDue]);

  // 스와이프 시점에 네트워크를 타지 않도록 미리 불러온다. 실패해도 조용히 넘어가고 다음 임계값 체크에서 다시 시도한다.
  const prefetchMore = useCallback(async () => {
    const target = activeSourceRef.current;
    if (target?.deckId == null) return;
    if (fixedQueueRef.current || wholeListRef.current) return;
    if (prefetchingRef.current) return;
    const loaded = cardsRef.current.length;
    const remaining = loaded - currentIndexRef.current;
    if (remaining > PREFETCH_REMAINING_THRESHOLD) return;
    if (loaded >= reviewedCountRef.current + dueCountRef.current) return;
    prefetchingRef.current = true;
    const version = requestVersion.current;
    try {
      const due = await flashcardApi.getDueCards(target.deckId, DUE_PAGE_SIZE);
      if (version !== requestVersion.current) return;
      setCards(prev => {
        const existingIds = new Set(prev.map(card => card.id));
        const additions = due.cards
          .filter(card => !existingIds.has(card.id))
          .map(card => ({ ...card, source: target }));
        return additions.length > 0 ? [...prev, ...additions] : prev;
      });
      setDueCount(due.totalCount);
    } catch {
      // 다음 임계값 체크에서 재시도한다.
    } finally {
      prefetchingRef.current = false;
    }
  }, []);

  /**
   * due 덱이 하나도 없을 때 최근 곡·추천곡의 곡 세션 카드를 띄운다. 맨 앞은 서버가 고른 중요도 1위다.
   * 성공(카드를 세팅했든, 낡은 요청이라 무시했든)하면 true.
   */
  const tryShowPreviewCard = useCallback(async (source: StudySource, version: number): Promise<boolean> => {
    if (source.songId == null) return false;
    try {
      const result = await songApi.getStudyCards(source.songId);
      if (version !== requestVersion.current) return true;
      if (result.cards.length === 0) return false;
      startWholeList(source, result.deckId, result.cards, result.totalCount);
      return true;
    } catch {
      // 추천곡 분석이 아직 없거나 조회에 실패하면 조용히 폴백(완료+추천곡 넛지)으로 넘긴다.
      return false;
    }
  }, [startWholeList]);

  const loadHomeStack = useCallback(async () => {
    const version = ++requestVersion.current;
    const homeVersion = ++homeLoadVersion.current;
    activeSourceRef.current = null;
    fixedQueueRef.current = false;
    wholeListRef.current = false;
    setDueCount(0);
    setDueTodayCount(0);
    setReviewedCount(0);
    setSessionDueTotal(0);
    reviewedIdsRef.current = new Set();
    setDistinctReviewedCount(0);
    setMemoryDiff(EMPTY_MEMORY_DIFF);
    setStatus('loading');
    setLoadError(null);
    // 첫 카드는 덱 목록만 있으면 고를 수 있다. 나머지까지 기다리면, 앱 시작 직후 동시 요청 상한(Android 5개)에 밀린
    // 요청 때문에 한국-서버 왕복(~300ms)이 한 번 더 든다. 칩·넛지 값은 도착하는 대로 채운다.
    const isCurrentHome = () => homeVersion === homeLoadVersion.current;
    const decksRequest = deckApi.getDecks();
    const recommendationsRequest = songApi.getRecommendations().then(items => items.map(sourceFromRecommendation));
    // 덱 목록이 실패하면 아무도 기다리지 않아 처리 안 된 rejection 으로 남는다.
    recommendationsRequest.catch(() => undefined);
    // 최근 곡은 추천곡을 대신할 뿐이라, 실패해도 홈을 깨지 않고 추천곡으로 넘어간다.
    const recentRequest = songApi.getRecent().catch(() => []);
    // 헤더 칩·넛지·축하 화면은 streakStore 가 든다. 실패 시 임의값으로 메우지 않는다.
    studyStatsApi.getHome()
      .then(homeStats => { if (isCurrentHome()) useStreakStore.getState().applyHomeStats(homeStats); })
      .catch(() => undefined);
    flashcardApi.getStats()
      .then(stats => { if (isCurrentHome()) setDueTodayCount(stats.due); })
      .catch(() => undefined);
    try {
      const deckRes = await decksRequest;
      if (version !== requestVersion.current) return;

      // 곡에 매핑되지 않은 일반 단어장(songId == null)은 덱 스트립의 곡 선택 대상이 아니다.
      const songDecks = deckRes.songDecks.filter(deck => deck.songId != null);
      if (songDecks.length > 0) {
        recommendationsRequest
          .then(items => { if (isCurrentHome()) setRecommendedSource(items[0] ?? null); })
          .catch(() => undefined);
        const sortedDeckSources = [...songDecks]
          .sort((a, b) => b.dueCount - a.dueCount)
          .map(sourceFromDeck);
        setDeckStripItems(sortedDeckSources);
        const firstSource = sortedDeckSources[0];
        const followingDeck = songDecks
          .filter(deck => deck.dueCount > 0 && deck.deckId !== firstSource.deckId)
          .sort((a, b) => b.dueCount - a.dueCount)[0];
        setNextDueSource(followingDeck ? sourceFromDeck(followingDeck) : null);
        await loadCardsForSource(firstSource);
        return;
      }

      // 곡을 하나도 담지 않은 유저 — 최근 연 곡이 있으면 그 곡들을, 없으면 추천곡을 덱 스트립에 보여준다.
      const [recommendedItems, recentSongs] = await Promise.all([recommendationsRequest, recentRequest]);
      if (version !== requestVersion.current) return;
      const fallbackItems = recentSongs.length > 0 ? recentSongs.map(sourceFromRecent) : recommendedItems;
      const fallback = fallbackItems[0] ?? null;
      setRecommendedSource(fallback);
      setDeckStripItems(fallbackItems);
      setSelectedSource(fallback);
      setNextDueSource(null);
      const showedPreview = fallback != null && await tryShowPreviewCard(fallback, version);
      if (version !== requestVersion.current) return;
      if (!showedPreview) {
        showCompletion(null, []);
      }
    } catch (e: any) {
      if (version !== requestVersion.current) return;
      setLoadError(e.message ?? '홈 데이터를 불러오지 못했어요');
      setDueTodayCount(0);
      setCards([]);
      setCompletedSource(null);
      setNextDueSource(null);
      setDeckStripItems([]);
      setStatus('error');
    }
  }, [loadCardsForSource, showCompletion, tryShowPreviewCard]);

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

  const refreshCurrentCard = useCallback(async () => {
    const card = currentCard;
    if (!card || isUnsavedCard(card)) return;
    try {
      const word = await wordApi.getById(card.wordId);
      if (!word) return;
      setCards(prev => prev.map(c => (c.id === card.id ? { ...c, reading: word.reading, senses: word.senses } : c)));
    } catch {
      // 편집 결과가 잠시 안 보일 뿐이다 — 다음 로드에서 맞춰진다.
    }
  }, [currentCard]);

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

  useEffect(() => {
    if (status !== 'ready') return;
    if (activeSourceRef.current?.deckId == null) return;
    void prefetchMore();
  }, [cards.length, currentIndex, status, prefetchMore]);

  const reveal = useCallback(() => {
    if (!revealed && currentCardRef.current) {
      hapticReveal();
      trackCardReveal({ mode, position: reviewedCountRef.current, is_preview: !!currentCardRef.current.saveOnReview });
    }
    setRevealed(true);
    Animated.timing(revealProgress, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mode, revealProgress, revealed]);

  /** 곡 단어장에 없는 카드는 이 rating 이 그 단어 하나를 담는다([reviewCard]). 다른 카드는 담지 않는다. */
  const advanceAfterReview = useCallback(async () => {
    if (!currentCard || selectedRating == null || busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    const version = ++requestVersion.current;
    const reviewedCard = currentCard;
    const rating = selectedRating;
    const position = reviewedCountRef.current;
    clearRatingHold();
    setSelectedRating(null);
    hapticCardDone();
    // API 응답을 기다리지 않고 스와이프 애니메이션을 동시에 시작한다.
    const reviewPromise = reviewCard(reviewedCard, rating);
    const animationPromise = new Promise<void>(resolve => {
      Animated.timing(translateY, {
        toValue: SWIPE_OUT_DISTANCE,
        duration: 180,
        useNativeDriver: true,
      }).start(() => resolve());
    });
    try {
      const [, reviewResult] = await Promise.all([animationPromise, reviewPromise]);
      if (version !== requestVersion.current) return;
      trackCardRate({ mode, position, is_preview: !!reviewedCard.saveOnReview }, rating);
      useStudyStatsStore.getState().invalidate();
      useStreakStore.getState().recordRating();
      useRewardCardStore.getState().receiveReveals(reviewResult.rewardCards);
      setReviewError(null);
      const active = activeSourceRef.current;
      if (reviewResult.deckId != null && active != null && active.deckId == null) {
        // 첫 rating 이 곡 단어장을 만들었다 — 다 본 뒤 곡 덱 due 로 이어가려면 덱이 있어야 한다.
        activeSourceRef.current = { ...active, deckId: reviewResult.deckId };
      }
      setMemoryDiff(diff => accumulateMemoryDiff(diff, reviewedCard.memory, reviewResult.memory));
      const reviewedAt = Date.now();
      if (lastReviewedAtRef.current != null) {
        const gap = (reviewedAt - lastReviewedAtRef.current) / 1000;
        if (gap <= MAX_CARD_GAP_SECONDS) cardGapsRef.current.push(gap);
      }
      lastReviewedAtRef.current = reviewedAt;
      setReviewedCount(count => count + 1);
      if (!reviewedIdsRef.current.has(reviewedCard.id)) {
        reviewedIdsRef.current.add(reviewedCard.id);
        setDistinctReviewedCount(count => count + 1);
      }
      // 안 담은 단어였다면 방금 생긴 카드가 곡 덱 due 로 다시 와도 같은 카드로 센다.
      reviewedIdsRef.current.add(reviewResult.id);
      // FSRS 는 리뷰 직후 due 를 항상 미래로 미룬다 — 서버 왕복 없이 큐 카운터를 맞춰둔다.
      setDueCount(count => Math.max(0, count - 1));
      // 안 담은 단어는 오늘 due 에 들어 있지 않았다.
      if (!isUnsavedCard(reviewedCard)) setDueTodayCount(count => Math.max(0, count - 1));
      // 덱 스트립 due 배지도 같이 줄인다 — 다시 불러오기 전까지 로드 시점 값으로 멈춰 있으면
      // 다 푼 곡에 남은 장수가 그대로 붙어 있다.
      const reviewedDeckId = reviewedCard.source.deckId;
      if (reviewedDeckId != null) {
        setDeckStripItems(items => items.map(item => (
          item.deckId === reviewedDeckId
            ? { ...item, dueCount: Math.max(0, item.dueCount - 1) }
            : item
        )));
      }
      const nextIndex = currentIndexRef.current + 1;
      if (nextIndex < cardsRef.current.length) {
        // 새 Animated.Value 로 교체해 다음 카드가 정지 상태(0)로 렌더되게 한다.
        setCurrentIndex(nextIndex);
        setTranslateY(new Animated.Value(0));
        setRevealProgress(new Animated.Value(0));
        setRevealed(false);
      } else {
        // 저장 성공 뒤 조회만 실패해도 평가를 중복 제출하지 않도록 이 폴백은 review 를 다시 부르지 않는다.
        await refreshDue();
      }
    } catch (e: any) {
      // 애니메이션은 실패하지 않으니 review 실패다. 카드가 이미 화면 밖에 있을 수 있어 되돌린다.
      await animationPromise;
      if (version === requestVersion.current) {
        setReviewError(e.message ?? '복습 저장에 실패했어요. 다시 시도해 주세요');
      }
      translateY.setValue(0);
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }, [clearRatingHold, currentCard, mode, refreshDue, selectedRating, translateY]);

  const advanceAfterReviewRef = useRef(advanceAfterReview);
  advanceAfterReviewRef.current = advanceAfterReview;

  const startRatingHold = useCallback(() => {
    clearRatingHold();
    ratingHoldTimerRef.current = setTimeout(() => {
      ratingHoldTimerRef.current = null;
      void advanceAfterReviewRef.current();
    }, RATING_HOLD_MS);
  }, [clearRatingHold]);

  /**
   * rating 탭. 선택을 강조한 채 RATING_HOLD_MS 만큼 머문 뒤 자동으로 다음 카드로 넘어간다.
   * 홀드 중 다른 버튼을 누르면 그쪽으로 바꿔 홀드를 다시 센다.
   */
  const selectRating = useCallback((rating: number) => {
    if (busyRef.current || selectedRatingRef.current === rating) return;
    hapticRatingSelect();
    setSelectedRating(rating);
    startRatingHold();
  }, [startRatingHold]);

  // 홀드 중엔 버튼 넷이 사라지고 "N일 뒤에 다시 만나요" pill 만 남아 유저는 이걸 확인 버튼으로 누른다.
  // 예전처럼 취소로 받으면 누를 때마다 되돌아가 다음 카드로 못 넘어간다.
  const commitRating = useCallback(() => {
    if (selectedRatingRef.current == null) return;
    clearRatingHold();
    void advanceAfterReviewRef.current();
  }, [clearRatingHold]);

  // 뒷면 위로 스와이프는 홀드를 기다리지 않고 바로 넘기는 단축키다. 드래그 중엔 타이머를
  // 멈추고, 놓았는데 임계값에 못 미치면 제자리로 돌아오면서 홀드를 다시 센다.
  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        revealed
        && selectedRating != null
        && gesture.dy < -8
        && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
      onPanResponderGrant: () => {
        clearRatingHold();
      },
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          translateY.setValue(Math.max(gesture.dy, SWIPE_OUT_DISTANCE));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < SWIPE_COMMIT_DISTANCE) {
          clearRatingHold();
          advanceAfterReview();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          startRatingHold();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        startRatingHold();
      },
    }),
    [advanceAfterReview, clearRatingHold, revealed, selectedRating, startRatingHold, translateY],
  );

  // 복습할 곡이 더 없어도 방금 끝낸 곡에 안 배운 단어가 남았으면 그 곡을 이어서 배우게 한다.
  // 홈에서 due 한 장만 풀고 완주 카드를 본 유저가 곡 상세까지 돌아가서 새 단어를 시작했다.
  useEffect(() => {
    setSongNewSource(null);
    setSongNewPending(false);
    const completed = completedSource;
    if (!isComplete || nextDueSource != null || completed?.songId == null) return;
    const songId = completed.songId;
    let cancelled = false;
    setSongNewPending(true);
    void (async () => {
      try {
        const result = await songApi.getStudyCards(songId);
        if (cancelled) return;
        const newCount = result.cards.filter(card => !card.inSongDeck).length;
        if (newCount === 0) return;
        setSongNewSource({
          ...completed,
          deckId: result.deckId ?? completed.deckId,
          totalCount: newCount,
          leadWordId: null,
          previewWord: null,
          tierKey: null,
        });
      } catch {
        // 넛지가 추천곡·검색으로 내려갈 뿐이다.
      } finally {
        if (!cancelled) setSongNewPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [completedSource, isComplete, nextDueSource]);

  const continueDue = useCallback(() => {
    if (!nextDueSource) return;
    loadCardsForSource(nextDueSource);
  }, [loadCardsForSource, nextDueSource]);

  // 아직 덱이 없는 곡(추천곡)을 곡 세션 카드로 연다 — 최초 진입의 tryShowPreviewCard 와 같은 경로다.
  const startPreview = useCallback((target: StudySource) => {
    const version = ++requestVersion.current;
    activeSourceRef.current = null;
    fixedQueueRef.current = false;
    wholeListRef.current = false;
    setSelectedSource(target);
    setStatus('loading');
    setLoadError(null);
    setCards([]);
    setDueCount(0);
    setReviewedCount(0);
    setSessionDueTotal(0);
    reviewedIdsRef.current = new Set();
    setDistinctReviewedCount(0);
    setMemoryDiff(EMPTY_MEMORY_DIFF);
    setCompletedSource(null);
    void (async () => {
      const showed = await tryShowPreviewCard(target, version);
      if (version !== requestVersion.current) return;
      if (!showed) showCompletion(null, []);
    })();
  }, [showCompletion, tryShowPreviewCard]);

  const selectSource = useCallback((target: StudySource) => {
    if (selectedSourceRef.current?.songId === target.songId) return;
    if (target.deckId != null) {
      loadCardsForSource(target);
      return;
    }
    startPreview(target);
  }, [loadCardsForSource, startPreview]);

  // 콜드스타트에선 추천곡이 이미 selectedSource 라 selectSource 의 같은 곡 가드를 타면 안 된다.
  const startRecommended = useCallback(() => {
    if (!recommendedSource) return;
    startPreview(recommendedSource);
  }, [recommendedSource, startPreview]);

  const startSongNew = useCallback(() => {
    if (!songNewSource) return;
    startPreview(songNewSource);
  }, [songNewSource, startPreview]);

  const removeDeck = useCallback((deckId: number) => {
    if (selectedSourceRef.current?.deckId === deckId || activeSourceRef.current?.deckId === deckId) {
      reload();
      return;
    }
    setDeckStripItems(items => items.filter(item => item.deckId !== deckId));
    setNextDueSource(next => (next?.deckId === deckId ? null : next));
    flashcardApi.getStats()
      .then(stats => setDueTodayCount(stats.due))
      .catch(() => undefined);
  }, [reload]);

  const panHandlers = panResponder.panHandlers;

  // 반환 객체를 고정한다 — 매 렌더 새 객체면 StudyStack 의 React.memo 가 항상 miss 난다.
  return useMemo(() => ({
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
    songNewSource,
    songNewPending,
    recommendedSource,
    deckStripItems,
    dueTodayCount,
    selectedSource,
    visibleSource,
    session,
    memoryDiff,
    translateY,
    revealProgress,
    panHandlers,
    reveal,
    selectRating,
    commitRating,
    reload,
    refreshCurrentCard,
    continueDue,
    startSongNew,
    selectSource,
    startRecommended,
    removeDeck,
  }), [
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
    songNewSource,
    songNewPending,
    recommendedSource,
    deckStripItems,
    dueTodayCount,
    selectedSource,
    visibleSource,
    session,
    memoryDiff,
    translateY,
    revealProgress,
    panHandlers,
    reveal,
    selectRating,
    commitRating,
    reload,
    refreshCurrentCard,
    continueDue,
    startSongNew,
    selectSource,
    startRecommended,
    removeDeck,
  ]);
}
