import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, GestureResponderHandlers, PanResponder } from 'react-native';
import { deckApi } from '../../api/deckApi';
import { flashcardApi } from '../../api/flashcardApi';
import { songApi } from '../../api/songApi';
import { studyStatsApi } from '../../api/studyStatsApi';
import { wordApi } from '../../api/wordApi';
import { useStreakStore } from '../../stores/streakStore';
import { useStudyStatsStore } from '../../stores/studyStatsStore';
import { SongDeckSummary } from '../../types/deck';
import { WordInSongItemDto, WordsInSongDto } from '../../types/song';
import { sourceFromDeck, sourceFromRecommendation } from './studySource';
import {
  PREVIEW_FLASHCARD_ID,
  StudyCard,
  StudyPreviewWord,
  StudySessionProgress,
  StudySource,
  StudyStackStatus,
} from './types';

/** 카드가 완전히 사라지는(=다음 카드가 완전히 드러나는) 지점. 드래그도 이 지점까지 막힘없이 따라간다. */
export const SWIPE_OUT_DISTANCE = -420;
const SWIPE_COMMIT_DISTANCE = -72;
/**
 * rating 을 고른 뒤 선택을 강조한 채 머무는 시간. 이 안에 같은 버튼을 다시 누르면 취소된다.
 * pill 이 합쳐지는 데 160ms 가 들어가므로 '1분 뒤에 다시 만나요' 문구가 읽힐 만큼 남겨 둔다.
 */
export const RATING_HOLD_MS = 900;

const DUE_PAGE_SIZE = 20;
/** 로컬 버퍼에 이 개수 이하로 남으면 다음 페이지를 미리 불러온다. */
const PREFETCH_REMAINING_THRESHOLD = 5;

// 서버 WordFilterDefaultsDto 기본값과 동일 기준 — 홈 미리보기가 서버가 실제로 부트스트랩할
// lead 단어와 다른 단어를 보여주면 안 되므로 정렬·필터 기준을 여기서도 그대로 맞춘다.
const DEFAULT_ELIGIBLE_POS = new Set(['NOUN', 'VERB', 'ADJECTIVE', 'NA_ADJECTIVE', 'ADVERB']);
const DEFAULT_ELIGIBLE_JLPT = new Set(['N1', 'N2', 'N3', 'N4', 'N5']);

function matchesDefaultFilters(word: WordInSongItemDto): boolean {
  const matchesPos = DEFAULT_ELIGIBLE_POS.has(word.partOfSpeech);
  const matchesJlpt = word.jlpt == null ? true : DEFAULT_ELIGIBLE_JLPT.has(word.jlpt);
  return matchesPos && matchesJlpt;
}

/** 서버 `SongDetailQueryService.IMPORTANCE_RANKING` 과 동일한 랭킹으로 lead 후보를 고른다. */
function pickLeadCandidate(data: WordsInSongDto): WordInSongItemDto | null {
  const eligible = data.words.filter(word => matchesDefaultFilters(word) && !word.isSavedForSong);
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => {
    if (b.importanceScore !== a.importanceScore) return b.importanceScore - a.importanceScore;
    if (a.appearanceOrder !== b.appearanceOrder) return a.appearanceOrder - b.appearanceOrder;
    return a.japanese.localeCompare(b.japanese);
  })[0];
}

function toPreviewCard(lead: StudyPreviewWord, source: StudySource): StudyCard {
  return {
    id: PREVIEW_FLASHCARD_ID,
    wordId: PREVIEW_FLASHCARD_ID,
    japanese: lead.japanese,
    reading: lead.reading,
    senses: lead.senses,
    state: 0,
    due: new Date().toISOString(),
    intervals: null,
    source: { ...source, totalCount: 1 },
  };
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
  recommendedSource: StudySource | null;
  /** mode 'home' 에서만 채워진다. 덱 스트립에 그릴 목록 — 곡 덱이 있으면 due 많은 순 덱 목록, 없으면 추천곡 목록. */
  deckStripItems: StudySource[];
  /** 덱 스트립에서 현재 강조돼야 할 항목. `selectSource` 로 바뀐다. */
  selectedSource: StudySource | null;
  /** 무대(아트워크)가 그려야 할 곡. 아무 것도 없으면 null. */
  visibleSource: StudySource | null;
  session: StudySessionProgress;
  translateY: Animated.Value;
  revealProgress: Animated.Value;
  panHandlers: GestureResponderHandlers;
  reveal: () => void;
  selectRating: (rating: number) => void;
  reload: () => void;
  /** 단어 편집 화면에서 돌아왔을 때 현재 카드의 읽기·뜻만 다시 받는다. 큐·진행도는 건드리지 않는다. */
  refreshCurrentCard: () => Promise<void>;
  continueDue: () => void;
  /** 덱 스트립에서 곡을 골랐을 때. 덱이 있으면 그 덱을 열고, 없으면(추천곡) 미리보기 카드를 띄운다. */
  selectSource: (target: StudySource) => void;
  /** 완주 카드의 추천곡 CTA. 그 자리에서 추천곡 미리보기 카드를 띄워 학습을 이어간다. */
  startRecommended: () => void;
}

export function useStudyStack({ mode, source }: UseStudyStackOptions): StudyStackState {
  const activeSourceRef = useRef<StudySource | null>(null);
  const requestVersion = useRef(0);
  const busyRef = useRef(false);
  /** 현재 카드가 실제 flashcard 가 아니라 미리보기 카드(홈 콜드스타트 또는 곡 상세의 안 담긴 단어)인지. */
  const isPreviewRef = useRef(false);
  /** 단계 학습처럼 처음 받은 카드가 전부인 세션인지. 이때는 서버 due 큐로 이어 붙이지 않는다. */
  const fixedQueueRef = useRef(false);
  const [dueCount, setDueCount] = useState(0);
  const [status, setStatus] = useState<StudyStackStatus>('loading');
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [completedSource, setCompletedSource] = useState<StudySource | null>(null);
  const [nextDueSource, setNextDueSource] = useState<StudySource | null>(null);
  const [recommendedSource, setRecommendedSource] = useState<StudySource | null>(null);
  const [deckStripItems, setDeckStripItems] = useState<StudySource[]>([]);
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
  // 카드마다 새 인스턴스로 교체한다 — 하나를 계속 재사용해 setValue(0) 으로 리셋하면
  // "내용 교체(React 렌더)" 와 "위치/투명도 리셋(Animated 값)" 이 서로 다른 파이프라인이라
  // 완전히 같은 프레임에 반영된다는 보장이 없다: 늦게 반영되면 새 카드가 여전히
  // translateY=SWIPE_OUT_DISTANCE 인 채로 화면 밖에 밀려 탭이 안 먹히고, 일찍 반영되면
  // 아직 안 바뀐 레이어 내용이 fully opaque 로 잠깐 노출된다. 새 값은 항상 0에서
  // 시작하므로 이런 경합 자체가 생기지 않는다.
  const [translateY, setTranslateY] = useState<Animated.Value>(() => new Animated.Value(0));
  const [revealProgress, setRevealProgress] = useState<Animated.Value>(() => new Animated.Value(0));

  const sourceRef = useRef<StudySource | null>(source ?? null);
  sourceRef.current = source ?? null;
  const sourceKey = source ? `${source.deckId}:${source.songId}:${source.tierKey ?? ''}` : null;

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
    };
  }, [sessionDueTotal, distinctReviewedCount, completedSource, currentCard, reviewedCount]);

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

  // 완료 화면에 들어갈 때마다 덱 목록을 다시 읽어 다음 due 덱을 고른다 — 진입 시 잡아둔
  // nextDueSource 는 리뷰가 진행되면 낡는다. 실패하면 마지막으로 알던 값을 그대로 둔다.
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
    clearRatingHold();
    setSelectedRating(null);
    setRevealed(false);
    isPreviewRef.current = false;
    fixedQueueRef.current = false;
    try {
      if (target.tierKey != null && target.songId != null) {
        // 단계 학습: 서버가 그 단계 단어를 담고 due 와 무관하게 전부 준다. 이 목록이 세션의 전부다.
        const result = await songApi.studyWordTier(target.songId, target.tierKey);
        if (version !== requestVersion.current) return;
        const tierSource: StudySource = { ...target, deckId: result.deckId, totalCount: result.totalCount };
        activeSourceRef.current = tierSource;
        fixedQueueRef.current = true;
        setDueCount(result.cards.length);
        setSessionDueTotal(result.totalCount);
        if (result.cards.length > 0) {
          setCards(result.cards.map(card => ({ ...card, source: tierSource })));
        } else {
          setCards([]);
          setCompletedSource(tierSource);
        }
        setStatus('ready');
        return;
      }
      if (target.previewWord) {
        // 곡 상세에서 아직 안 담긴 단어를 눌렀다 — 덱을 만들지 않고 그 단어를 미리보기 카드로 띄운다.
        // rating 확정 시 advancePreviewReview 가 곡을 통째로 담는다.
        isPreviewRef.current = true;
        activeSourceRef.current = null;
        setCards([toPreviewCard(target.previewWord, target)]);
        setStatus('ready');
        return;
      }
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
  }, [clearRatingHold, refreshNextDue]);

  // 서버 큐의 맨 앞을 다시 읽는다. 이미 평가한 카드도 다시 due 가 될 수 있다.
  // 로컬 버퍼가 바닥났을 때의 폴백으로만 쓰인다 — 매 리뷰마다 부르지 않는다.
  const refreshDue = useCallback(async () => {
    const target = activeSourceRef.current;
    if (target?.deckId == null) return;
    const version = ++requestVersion.current;
    if (fixedQueueRef.current) {
      // 단계 학습은 처음 받은 카드가 전부다 — 서버 due 큐로 이어가지 않고 완료 화면으로 간다.
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
    try {
      const due = await flashcardApi.getDueCards(target.deckId, DUE_PAGE_SIZE);
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

  // 무한스크롤처럼 로컬 버퍼가 얼마 안 남았을 때 다음 페이지를 미리 불러와 이어붙인다.
  // 스와이프 시점엔 네트워크를 타지 않도록 하는 게 목적이라 실패해도 조용히 넘어간다 —
  // 다음 임계값 체크에서 다시 시도한다.
  const prefetchMore = useCallback(async () => {
    const target = activeSourceRef.current;
    if (target?.deckId == null) return;
    if (fixedQueueRef.current) return;
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
      // 조용히 실패 — 다음 임계값 체크에서 재시도한다.
    } finally {
      prefetchingRef.current = false;
    }
  }, []);

  /**
   * due 덱이 하나도 없을 때 추천곡에서 lead 후보를 찾아 미리보기 카드로 띄운다.
   * 성공(진짜 카드를 세팅했든, 후보가 없어 폴백이 필요하다고 판단했든)하면 true.
   */
  const tryShowPreviewCard = useCallback(async (source: StudySource, version: number): Promise<boolean> => {
    if (source.songId == null) return false;
    try {
      const words = await songApi.getWords(source.songId);
      if (version !== requestVersion.current) return true;
      const lead = pickLeadCandidate(words);
      if (!lead) return false;
      isPreviewRef.current = true;
      activeSourceRef.current = null;
      setCards([toPreviewCard(lead, source)]);
      setCurrentIndex(0);
      setCompletedSource(null);
      setRevealed(false);
      setRevealProgress(new Animated.Value(0));
      clearRatingHold();
      setSelectedRating(null);
      setTranslateY(new Animated.Value(0));
      setStatus('ready');
      return true;
    } catch {
      // 추천곡 분석이 아직 없거나 조회에 실패하면 조용히 폴백(완료+추천곡 넛지)으로 넘긴다.
      return false;
    }
  }, [clearRatingHold]);

  const loadHomeStack = useCallback(async () => {
    const version = ++requestVersion.current;
    activeSourceRef.current = null;
    isPreviewRef.current = false;
    fixedQueueRef.current = false;
    setDueCount(0);
    setReviewedCount(0);
    setSessionDueTotal(0);
    reviewedIdsRef.current = new Set();
    setDistinctReviewedCount(0);
    setStatus('loading');
    setLoadError(null);
    try {
      const [deckRes, homeStats, recommendations] = await Promise.all([
        deckApi.getDecks(),
        studyStatsApi.getHome(),
        songApi.getRecommendations(),
      ]);
      if (version !== requestVersion.current) return;
      const recommendedItems = recommendations.map(sourceFromRecommendation);
      const recommended = recommendedItems[0] ?? null;
      setRecommendedSource(recommended);
      // 헤더 칩·넛지·완료 배너는 streakStore 가 든다. 실패 시 임의값으로 메우지 않는다.
      useStreakStore.getState().applyHomeStats(homeStats);

      // 곡에 매핑되지 않은 일반 단어장(songId == null)은 덱 스트립의 곡 선택 대상이 아니다.
      const songDecks = deckRes.songDecks.filter(deck => deck.songId != null);
      if (songDecks.length > 0) {
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

      // 곡을 하나도 담지 않은 신규유저 — 덱 스트립에 추천곡을 대신 보여준다.
      setDeckStripItems(recommendedItems);
      setSelectedSource(recommended);
      setNextDueSource(null);
      const showedPreview = recommended != null && await tryShowPreviewCard(recommended, version);
      if (version !== requestVersion.current) return;
      if (!showedPreview) {
        showCompletion(null, []);
      }
    } catch (e: any) {
      if (version !== requestVersion.current) return;
      setLoadError(e.message ?? '홈 데이터를 불러오지 못했어요');
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
    if (!card || card.id === PREVIEW_FLASHCARD_ID) return;
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

  // 로컬 버퍼가 임계값 이하로 남을 때마다 다음 페이지를 미리 불러온다 (무한스크롤과 동일한 패턴).
  useEffect(() => {
    if (status !== 'ready') return;
    if (activeSourceRef.current?.deckId == null) return;
    void prefetchMore();
  }, [cards.length, currentIndex, status, prefetchMore]);

  const reveal = useCallback(() => {
    setRevealed(true);
    Animated.timing(revealProgress, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [revealProgress]);

  /**
   * 미리보기 카드의 rating 확정. 이 순간에만 서버에 그 곡을 통째로 담고(SongDetailScreen 의
   * "학습 시작"과 동일 기준) lead 단어를 곧바로 리뷰한다 — 응답의 남은 due 카드로 곧장 이어서
   * 복습한다. 홈 콜드스타트는 서버가 중요도 1위를 lead 로 고르고, 곡 상세에서 온 미리보기는
   * 유저가 고른 단어(`previewWord`)가 lead 다.
   *
   * 실패해도 이미 스와이프 아웃된 카드를 되돌리지 않는다 — 부분 실패(단어는 담겼는데 리뷰만
   * 실패)여도 다음 홈 진입에서 정상적으로 다시 due 로 잡히므로 스스로 복구된다.
   */
  const advancePreviewReview = useCallback(async () => {
    if (!currentCard || selectedRating == null || busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    const version = ++requestVersion.current;
    const songId = currentCard.source.songId;
    const rating = selectedRating;
    try {
      clearRatingHold();
      setSelectedRating(null);
      await new Promise<void>(resolve => {
        Animated.timing(translateY, {
          toValue: SWIPE_OUT_DISTANCE,
          duration: 180,
          useNativeDriver: true,
        }).start(() => resolve());
      });
      if (version !== requestVersion.current) return;
      if (songId == null) throw new Error('추천곡 정보를 확인하지 못했어요');
      const result = await songApi.studyBootstrap(songId, rating, currentCard.source.previewWord?.japanese);
      if (version !== requestVersion.current) return;
      useStudyStatsStore.getState().invalidate();
      useStreakStore.getState().recordRating();
      isPreviewRef.current = false;
      fixedQueueRef.current = false;
      const newSource: StudySource = {
        ...currentCard.source,
        deckId: result.deckId,
        totalCount: result.totalCount,
        previewWord: null,
      };
      activeSourceRef.current = newSource;
      setReviewError(null);
      setDueCount(result.cards.length);
      setSessionDueTotal(result.totalCount);
      reviewedIdsRef.current = new Set([PREVIEW_FLASHCARD_ID]);
      setReviewedCount(1);
      setDistinctReviewedCount(1);
      if (result.cards.length > 0) {
        setCards(result.cards.map(card => ({ ...card, source: newSource })));
        setCurrentIndex(0);
        setTranslateY(new Animated.Value(0));
        setRevealProgress(new Animated.Value(0));
        setRevealed(false);
      } else {
        setCards([]);
        setCompletedSource(newSource);
        setRevealProgress(new Animated.Value(0));
        setRevealed(false);
      }
      setStatus('ready');
    } catch (e: any) {
      if (version === requestVersion.current) {
        setReviewError(e.message ?? '복습 저장에 실패했어요. 다시 시도해 주세요');
      }
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }, [clearRatingHold, currentCard, selectedRating, translateY]);

  const advanceRealReview = useCallback(async () => {
    if (!currentCard || selectedRating == null || busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    const version = ++requestVersion.current;
    const reviewedCard = currentCard;
    const rating = selectedRating;
    clearRatingHold();
    setSelectedRating(null);
    // review API 호출과 스와이프 애니메이션을 동시에 시작한다 — 이전엔 API 응답을 먼저 기다린
    // 뒤에야 애니메이션을 시작해서 스와이프가 네트워크 왕복만큼 멈춰 보였다.
    const reviewPromise = flashcardApi.review(reviewedCard.id, { rating });
    const animationPromise = new Promise<void>(resolve => {
      Animated.timing(translateY, {
        toValue: SWIPE_OUT_DISTANCE,
        duration: 180,
        useNativeDriver: true,
      }).start(() => resolve());
    });
    try {
      await Promise.all([animationPromise, reviewPromise]);
      if (version !== requestVersion.current) return;
      useStudyStatsStore.getState().invalidate();
      useStreakStore.getState().recordRating();
      setReviewError(null);
      setReviewedCount(count => count + 1);
      if (!reviewedIdsRef.current.has(reviewedCard.id)) {
        reviewedIdsRef.current.add(reviewedCard.id);
        setDistinctReviewedCount(count => count + 1);
      }
      // FSRS 는 리뷰 직후 due 를 항상 미래로 미룬다 — 서버 왕복 없이 큐 카운터를 맞춰둔다.
      setDueCount(count => Math.max(0, count - 1));
      const nextIndex = currentIndexRef.current + 1;
      if (nextIndex < cardsRef.current.length) {
        // 다음 카드는 이미 미리 불러와져 있다 — 스와이프 도중 네트워크를 기다리지 않는다.
        // 새 Animated.Value 로 교체해 다음 카드가 처음부터 정지 상태(0)로 렌더되게 한다.
        setCurrentIndex(nextIndex);
        setTranslateY(new Animated.Value(0));
        setRevealProgress(new Animated.Value(0));
        setRevealed(false);
      } else {
        // 버퍼가 바닥났을 때만 서버를 다시 확인한다. 저장 성공 뒤 조회만 실패한 경우
        // 평가를 중복 제출하지 않도록 이 폴백에서도 review 를 다시 부르지 않는다.
        await refreshDue();
      }
    } catch (e: any) {
      // 애니메이션 자체는 실패하지 않으니 이 catch 는 review 실패다 — 카드가 이미 화면 밖으로
      // 나가 있을 수 있어 되돌린다.
      await animationPromise;
      if (version === requestVersion.current) {
        setReviewError(e.message ?? '복습 저장에 실패했어요. 다시 시도해 주세요');
      }
      translateY.setValue(0);
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }, [clearRatingHold, currentCard, refreshDue, selectedRating, translateY]);

  const advanceAfterReview = useCallback(async () => {
    if (isPreviewRef.current) {
      await advancePreviewReview();
      return;
    }
    await advanceRealReview();
  }, [advancePreviewReview, advanceRealReview]);

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
   * 홀드 중 같은 버튼을 다시 누르면 취소되고, 다른 버튼을 누르면 그쪽으로 바꿔 홀드를 다시 센다.
   */
  const selectRating = useCallback((rating: number) => {
    if (busyRef.current) return;
    if (selectedRatingRef.current === rating) {
      clearRatingHold();
      setSelectedRating(null);
      return;
    }
    setSelectedRating(rating);
    startRatingHold();
  }, [clearRatingHold, startRatingHold]);

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

  const continueDue = useCallback(() => {
    if (!nextDueSource) return;
    loadCardsForSource(nextDueSource);
  }, [loadCardsForSource, nextDueSource]);

  // 아직 덱이 없는 곡(추천곡)을 미리보기 카드 플로우로 연다 — 최초 진입의 tryShowPreviewCard 와 같은 경로다.
  const startPreview = useCallback((target: StudySource) => {
    const version = ++requestVersion.current;
    activeSourceRef.current = null;
    isPreviewRef.current = false;
    fixedQueueRef.current = false;
    setSelectedSource(target);
    setStatus('loading');
    setLoadError(null);
    setCards([]);
    setDueCount(0);
    setReviewedCount(0);
    setSessionDueTotal(0);
    reviewedIdsRef.current = new Set();
    setDistinctReviewedCount(0);
    setCompletedSource(null);
    void (async () => {
      const showed = await tryShowPreviewCard(target, version);
      if (version !== requestVersion.current) return;
      if (!showed) showCompletion(null, []);
    })();
  }, [showCompletion, tryShowPreviewCard]);

  // 덱 스트립에서 곡을 고른다. 이미 덱이 있으면 그 덱을 열고, 아직 없으면(콜드스타트 추천곡)
  // 미리보기 카드 플로우로 들어간다.
  const selectSource = useCallback((target: StudySource) => {
    if (selectedSourceRef.current?.songId === target.songId) return;
    if (target.deckId != null) {
      loadCardsForSource(target);
      return;
    }
    startPreview(target);
  }, [loadCardsForSource, startPreview]);

  // 완주 카드에서 추천곡을 고른다. 콜드스타트에선 loadHomeStack 이 추천곡을 이미 selectedSource 로
  // 잡아 두므로 selectSource 의 같은 곡 가드를 타면 안 된다.
  const startRecommended = useCallback(() => {
    if (!recommendedSource) return;
    startPreview(recommendedSource);
  }, [recommendedSource, startPreview]);

  const panHandlers = panResponder.panHandlers;

  // 반환 객체를 고정한다 — 매 렌더 새 객체를 주면 이걸 prop 으로 받는 StudyStack 의 React.memo 가
  // 항상 miss 나서 호출한 화면의 state 하나에 카드 서브트리 전체가 같이 그려진다.
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
    recommendedSource,
    deckStripItems,
    selectedSource,
    visibleSource,
    session,
    translateY,
    revealProgress,
    panHandlers,
    reveal,
    selectRating,
    reload,
    refreshCurrentCard,
    continueDue,
    selectSource,
    startRecommended,
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
    recommendedSource,
    deckStripItems,
    selectedSource,
    visibleSource,
    session,
    translateY,
    revealProgress,
    panHandlers,
    reveal,
    selectRating,
    reload,
    refreshCurrentCard,
    continueDue,
    selectSource,
    startRecommended,
  ]);
}
