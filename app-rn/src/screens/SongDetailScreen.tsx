import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  ImageBackground,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, FontAwesome6 } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useSongDetailStore } from '../stores/songDetailStore';
import { usePlayerStore } from '../stores/playerStore';
import { deckApi } from '../api/deckApi';
import { songApi } from '../api/songApi';
import { wordApi } from '../api/wordApi';
import { trackSongDetailOpen } from '../services/analytics';
import SkeletonBox from '../components/SkeletonLoading';
import SongInfoSheet from '../components/SongInfoSheet';
import ErrorDialog from '../components/ErrorDialog';
import { AppBottomSheet, AppBottomSheetRef, AppBottomSheetView } from '../components/bottomSheet';
import {
  CurrentPlayingWordsSheet,
  selectCurrentTier,
  SongDetailHomeTab,
  SONG_DETAIL_MV_BAR_HEIGHT,
  SongDetailMvBar,
  SongDetailWordsActionBar,
  SongDetailWordsTab,
  type SongDetailMvBarRef,
  type SongDetailWordItem,
  useSongDetailWordsTab,
} from '../components/songDetail';
import { getSongDetailWordKey } from '../components/songDetail/songDetailWordSave';
import { Colors, Dimens } from '../theme/theme';
import { Layers } from '../theme/layers';
import { Typography } from '../theme/typography';
import { RootStackParamList } from '../navigation/AppNavigator';
import type { DeckDetailResponse } from '../types/deck';
import type { SongWordTierDto } from '../types/song';

type Props = NativeStackScreenProps<RootStackParamList, 'SongDetail'>;
type DetailTab = 'home' | 'words';
type LearningActionMode = 'start' | 'review' | 'preparing';

const HERO_HEIGHT = 360;
const COLLAPSED_BAR_HEIGHT = 56;
const TAB_BAR_HEIGHT = 44;
const TAB_ITEM_WIDTH = 54;
const TAB_ITEM_GAP = 10;
const TAB_INDICATOR_WIDTH = 28;
const TAB_TRANSITION_MS = 260;
const WORDS_ACTION_BAR_HEIGHT = 50;
const WORDS_TAB_BOTTOM_CLEARANCE = SONG_DETAIL_MV_BAR_HEIGHT + 24;
const HERO_SCROLL_COLLAPSE_START = HERO_HEIGHT - COLLAPSED_BAR_HEIGHT - TAB_BAR_HEIGHT - 34;
const HERO_SCROLL_COLLAPSE_END = HERO_SCROLL_COLLAPSE_START + 56;
const ARTWORK_COLLAPSED_OFFSET = HERO_HEIGHT * 0.4;
const SKELETON_WORD_ROWS = [0, 1, 2, 3];
const SKELETON_LEGEND_ROWS = [0, 1, 2, 3, 4];

function isAnalyzedLine(line: { tokens: readonly unknown[]; koreanLyrics: string | null }) {
  return line.tokens.length > 0 || line.koreanLyrics != null;
}

export default function SongDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const scrollY = useRef(new Animated.Value(0)).current;
  const tabProgress = useRef(new Animated.Value(0)).current;
  const infoSheetRef = useRef<AppBottomSheetRef>(null);
  const infoSheetOpenRef = useRef(false);
  const isInitialFocusRef = useRef(true);

  const status = useSongDetailStore(s => s.status);
  const loadedSongId = useSongDetailStore(s => s.songId);
  const data = useSongDetailStore(s => s.data);
  const errorCode = useSongDetailStore(s => s.errorCode);
  const load = useSongDetailStore(s => s.load);
  const refreshWords = useSongDetailStore(s => s.refreshWords);
  const tiers = useSongDetailStore(s => s.tiers);
  const refreshTiers = useSongDetailStore(s => s.refreshTiers);
  const preloadedStudyData = usePlayerStore(s => s.studyData);
  const setCurrentMs = usePlayerStore(s => s.setCurrentMs);
  const setDurationMs = usePlayerStore(s => s.setDurationMs);

  const [activeTab, setActiveTab] = useState<DetailTab>('home');
  const [songDeckDetail, setSongDeckDetail] = useState<DeckDetailResponse | null>(null);
  const [isStartingLearning, setIsStartingLearning] = useState(false);
  const [learningError, setLearningError] = useState<string | null>(null);
  const [isPinnedTabsVisible, setIsPinnedTabsVisible] = useState(false);
  const [tabPageHeights, setTabPageHeights] = useState<Record<DetailTab, number>>({
    home: 0,
    words: 0,
  });
  const [busyWordKey, setBusyWordKey] = useState<string | null>(null);
  const notifiedSongIdRef = useRef<number | null>(null);
  const isPinnedTabsVisibleRef = useRef(false);

  const routeSongId = route.params?.songId;
  const fallbackSongId = preloadedStudyData?.song.id;
  const songId = routeSongId ?? fallbackSongId;

  useEffect(() => {
    setBusyWordKey(null);
  }, [songId]);

  useEffect(() => {
    if (songId == null) return;
    setCurrentMs(route.params?.initialSeekMs ?? 0);
    setDurationMs(0);
    load(songId);
  }, [load, route.params?.initialSeekMs, setCurrentMs, setDurationMs, songId]);

  useEffect(() => {
    if (songId == null) {
      setSongDeckDetail(null);
      return;
    }
    let cancelled = false;
    deckApi.getDeckBySongId(songId)
      .then(deck => {
        if (!cancelled) setSongDeckDetail(deck);
      })
      .catch(() => {
        if (!cancelled) setSongDeckDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [songId]);

  const appBarContentOpacity = useMemo(
    () => scrollY.interpolate({
      inputRange: [HERO_SCROLL_COLLAPSE_START, HERO_SCROLL_COLLAPSE_END],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    [scrollY],
  );

  const pinnedTabsOpacity = useMemo(
    () => scrollY.interpolate({
      inputRange: [HERO_SCROLL_COLLAPSE_END - 1, HERO_SCROLL_COLLAPSE_END],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    [scrollY],
  );

  const heroTextTranslate = useMemo(
    () => scrollY.interpolate({
      inputRange: [0, HERO_SCROLL_COLLAPSE_END],
      outputRange: [0, -HERO_SCROLL_COLLAPSE_END - 24],
      extrapolate: 'clamp',
    }),
    [scrollY],
  );

  const heroTextOpacity = useMemo(
    () => scrollY.interpolate({
      inputRange: [HERO_SCROLL_COLLAPSE_START - 24, HERO_SCROLL_COLLAPSE_END],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    [scrollY],
  );

  const appBarContentTranslate = useMemo(
    () => scrollY.interpolate({
      inputRange: [HERO_SCROLL_COLLAPSE_START, HERO_SCROLL_COLLAPSE_END],
      outputRange: [10, 0],
      extrapolate: 'clamp',
    }),
    [scrollY],
  );

  const artworkTranslate = useMemo(
    () => scrollY.interpolate({
      inputRange: [0, HERO_SCROLL_COLLAPSE_END],
      outputRange: [0, -ARTWORK_COLLAPSED_OFFSET],
      extrapolate: 'clamp',
    }),
    [scrollY],
  );

  const collapsedBarFullHeight = insets.top + COLLAPSED_BAR_HEIGHT;

  const bottomReserve = SONG_DETAIL_MV_BAR_HEIGHT + insets.bottom;

  const tabContentTranslate = useMemo(
    () => tabProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -screenWidth],
      extrapolate: 'clamp',
    }),
    [screenWidth, tabProgress],
  );

  const activePageHeight = tabPageHeights[activeTab];
  const tabViewportHeight = activePageHeight;

  useEffect(() => {
    Animated.timing(tabProgress, {
      toValue: activeTab === 'words' ? 1 : 0,
      duration: TAB_TRANSITION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabProgress]);

  const defaultDeckWords = useMemo(() => {
    const detail = data?.words;
    if (!detail) return [];
    const pos = new Set(detail.filterDefaults.pos);
    const jlpt = new Set(detail.filterDefaults.jlpt);
    const includeUnknown = detail.filterDefaults.includeUnknownJlpt;
    return detail.words
      .filter(word => {
        const matchesPos = pos.has(word.partOfSpeech);
        const matchesJlpt = word.jlpt == null ? includeUnknown : jlpt.has(word.jlpt);
        return matchesPos && matchesJlpt && !word.isSavedForSong;
      })
      .map(word => word.addRequest);
  }, [data]);

  const songTiers = tiers != null && tiers.songId === songId ? tiers.tiers : null;
  const currentTier = useMemo(
    () => (songTiers != null ? selectCurrentTier(songTiers) : null),
    [songTiers],
  );

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleOpenInfo = useCallback(() => {
    infoSheetOpenRef.current = true;
    infoSheetRef.current?.expand();
  }, []);

  const handleInfoSheetChange = useCallback((index: number) => {
    infoSheetOpenRef.current = index >= 0;
  }, []);

  const ensureSongDeck = useCallback(async (): Promise<DeckDetailResponse | null> => {
    if (songDeckDetail?.deckId != null) return songDeckDetail;
    if (songId == null || defaultDeckWords.length === 0) return null;

    await wordApi.batchAddWords({ words: defaultDeckWords });
    const deck = await deckApi.getDeckBySongId(songId);
    setSongDeckDetail(deck);
    await refreshWords(songId).catch(() => undefined);
    return deck;
  }, [defaultDeckWords, refreshWords, songDeckDetail, songId]);

  /** 이미 담긴 단어로 여는 경로라 덱이 있어야 정상이다 — 없으면 "학습 시작"과 같은 기본 담기로 만든다. */
  const resolveSongDeck = useCallback(async (): Promise<DeckDetailResponse | null> => {
    if (songDeckDetail?.deckId != null) return songDeckDetail;
    if (songId == null) return null;
    const deck = await deckApi.getDeckBySongId(songId);
    if (deck?.deckId != null) {
      setSongDeckDetail(deck);
      return deck;
    }
    return ensureSongDeck();
  }, [ensureSongDeck, songDeckDetail, songId]);

  const openSongReview = useCallback((deck: DeckDetailResponse, leadWordId?: number | null) => {
    if (songId == null || deck.deckId == null) return false;
    navigation.navigate('SongReview', {
      origin: 'SongDetail',
      source: {
        deckId: deck.deckId,
        songId,
        title: deck.title ?? data?.song.title ?? '',
        artist: deck.artist ?? data?.song.artist ?? '',
        artworkUrl: deck.artworkUrl ?? data?.song.artworkUrl ?? null,
        dueCount: deck.dueCount,
        totalCount: deck.wordCount,
        leadWordId: leadWordId ?? null,
      },
    });
    return true;
  }, [data?.song, navigation, songId]);

  /**
   * 단계 학습: 그 단계 단어 전부를 due·복습 상태와 무관하게 연다. 담기와 카드 조회는 복습 화면이
   * `POST /api/songs/{id}/word-tiers/{key}/study` 한 번으로 한다 — 곡 덱 due 큐를 열면 다른 단계
   * 단어가 섞이고 이미 익힌 단어는 빠진다.
   */
  const handleStartTier = useCallback((tier: SongWordTierDto) => {
    if (songId == null || isStartingLearning) return;
    navigation.navigate('SongReview', {
      origin: 'SongDetail',
      source: {
        deckId: songDeckDetail?.deckId ?? null,
        songId,
        title: data?.song.title ?? '',
        artist: data?.song.artist ?? '',
        artworkUrl: data?.song.artworkUrl ?? null,
        dueCount: 0,
        totalCount: tier.totalCount,
        tierKey: tier.key,
      },
    });
  }, [data?.song, isStartingLearning, navigation, songDeckDetail?.deckId, songId]);

  /**
   * CTA 라벨과 같은 기준으로 연다. `오늘 복습 N개`(due 있음)면 곡 단어장 due 복습을 연다 — 단계 학습은
   * due 와 무관하게 단계 단어 전부라 카드 수가 N 과 어긋난다. due 가 없으면 로드맵의 현재 단계를 열고,
   * 로드맵을 못 받았거나 모두 끝났으면 예전처럼 곡 단어장을 그대로 연다.
   */
  const handleStartLearning = useCallback(async () => {
    if (songId == null || isStartingLearning) return;
    if (songDeckDetail != null && songDeckDetail.dueCount > 0) {
      if (!openSongReview(songDeckDetail)) {
        setLearningError('학습할 단어를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
      return;
    }
    if (currentTier != null) {
      handleStartTier(currentTier);
      return;
    }
    setIsStartingLearning(true);
    try {
      const deck = await ensureSongDeck();
      if (deck == null || !openSongReview(deck)) {
        setLearningError('학습할 단어를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    } catch (e: any) {
      setLearningError(e?.message ?? '학습을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsStartingLearning(false);
    }
  }, [currentTier, ensureSongDeck, handleStartTier, isStartingLearning, openSongReview, songDeckDetail, songId]);

  /**
   * 단어를 누르면 그 곡 복습을 연다. 이미 담긴 단어는 그 덱을 열어 첫 카드로 강제한다.
   * 아직 안 담긴 단어는 여기서 담지 않는다 — 덱 없이 미리보기 카드로 먼저 보여주고, rating 을
   * 확정하는 순간 서버가 "학습 시작"과 같은 기준으로 곡을 통째로 담는다(`study-bootstrap`).
   * 단어 하나만 먼저 담으면 단어 하나짜리 곡 덱이 생기고 이후 기본 담기가 건너뛰어진다.
   */
  const handleStartWordReview = useCallback(async (word: SongDetailWordItem) => {
    if (songId == null || isStartingLearning) return;
    if (word.savedWordId == null) {
      navigation.navigate('SongReview', {
        origin: 'SongDetail',
        source: {
          deckId: songDeckDetail?.deckId ?? null,
          songId,
          title: data?.song.title ?? '',
          artist: data?.song.artist ?? '',
          artworkUrl: data?.song.artworkUrl ?? null,
          dueCount: songDeckDetail?.dueCount ?? 0,
          totalCount: songDeckDetail?.wordCount ?? 0,
          previewWord: {
            japanese: word.addRequest.japanese,
            reading: word.addRequest.reading ?? null,
            senses: word.addRequest.senses,
          },
        },
      });
      return;
    }
    setBusyWordKey(getSongDetailWordKey(word));
    setIsStartingLearning(true);
    try {
      const deck = await resolveSongDeck();
      if (deck == null || !openSongReview(deck, word.savedWordId)) {
        setLearningError('학습할 단어를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    } catch (e: any) {
      setLearningError(e?.message ?? '학습을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusyWordKey(null);
      setIsStartingLearning(false);
    }
  }, [data?.song, isStartingLearning, navigation, openSongReview, resolveSongDeck, songDeckDetail, songId]);

  const handlePrimaryLearningPress = useCallback(() => {
    handleStartLearning();
  }, [handleStartLearning]);

  const handleDismissLearningError = useCallback(() => {
    setLearningError(null);
  }, []);

  const handleSelectHome = useCallback(() => {
    setActiveTab('home');
  }, []);

  const handleSelectWords = useCallback(() => {
    setActiveTab('words');
  }, []);

  const handleRefreshAnalysisStatus = useCallback(() => {
    if (songId == null) return;
    load(songId);
  }, [load, songId]);

  const handleWordsChanged = useCallback(() => {
    if (songId == null) return;
    refreshWords(songId).catch(() => undefined);
    refreshTiers(songId).catch(() => undefined);
    deckApi.getDeckBySongId(songId)
      .then(deck => setSongDeckDetail(deck))
      .catch(() => setSongDeckDetail(null));
  }, [refreshTiers, refreshWords, songId]);

  const handleHomePageLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    setTabPageHeights(prev => prev.home === height ? prev : { ...prev, home: height });
  }, []);

  const handleWordsPageLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    setTabPageHeights(prev => prev.words === height ? prev : { ...prev, words: height });
  }, []);

  // 곡 탐색 퍼널의 마지막 단계. 체류 시간은 BigQuery 에서 이 이벤트와 다음
  // screen_view 의 간격으로 계산하므로 앱은 진입만 찍는다.
  useFocusEffect(
    useCallback(() => {
      if (songId == null) return;
      trackSongDetailOpen(songId, route.params?.origin ?? 'unknown');
    }, [route.params?.origin, songId]),
  );

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (infoSheetOpenRef.current) {
          infoSheetOpenRef.current = false;
          infoSheetRef.current?.close();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, []),
  );

  /** 다른 화면에 다녀온 뒤 돌아오면 단어 저장 상태와 덱 진행도를 다시 불러온다. 최초 마운트 시 진입은 건너뛴다. */
  useFocusEffect(
    useCallback(() => {
      if (isInitialFocusRef.current) {
        isInitialFocusRef.current = false;
        return;
      }
      handleWordsChanged();
    }, [handleWordsChanged]),
  );

  const handleScroll = useMemo(
    () => Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      {
        useNativeDriver: true,
        listener: event => {
          const y = (event as NativeSyntheticEvent<NativeScrollEvent>).nativeEvent.contentOffset.y;
          const nextVisible = y >= HERO_SCROLL_COLLAPSE_END;
          if (isPinnedTabsVisibleRef.current !== nextVisible) {
            isPinnedTabsVisibleRef.current = nextVisible;
            setIsPinnedTabsVisible(nextVisible);
          }
        },
      },
    ),
    [scrollY],
  );

  const wordsTabState = useSongDetailWordsTab({
    data: data?.words ?? null,
    isActive: activeTab === 'words',
  });

  const isSongAnalysisPending = data != null
    && loadedSongId === songId
    && data.words.words.length === 0
    && data.words.wordSummary.totalCandidateCount === 0
    && Object.keys(data.words.lineWordIndexes).length === 0
    && !data.lyrics.lines.some(isAnalyzedLine);

  useEffect(() => {
    if (songId == null || !isSongAnalysisPending) return;
    if (notifiedSongIdRef.current === songId) return;
    notifiedSongIdRef.current = songId;
    songApi.setAnalysisNotification(songId, true).catch(() => undefined);
  }, [isSongAnalysisPending, songId]);

  if (songId == null) {
    return (
      <View style={[styles.stateScreen, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>곡 정보를 찾을 수 없어요.</Text>
      </View>
    );
  }

  const isCurrentSong = loadedSongId === songId;
  if (!isCurrentSong || status === 'idle' || (status === 'loading' && data == null)) {
    return (
      <SongDetailLoadingSkeleton
        topInset={insets.top}
        bottomReserve={bottomReserve}
        collapsedBarFullHeight={collapsedBarFullHeight}
        onBack={handleBack}
      />
    );
  }

  if (status === 'error' || data == null) {
    return (
      <View style={[styles.stateScreen, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{errorCode ?? '곡 정보를 불러오지 못했어요.'}</Text>
      </View>
    );
  }

  const { song, lyrics, words } = data;
  const actionMode: LearningActionMode = isSongAnalysisPending
    ? 'preparing'
    : (songDeckDetail?.dueCount ?? 0) > 0 ? 'review' : 'start';
  const learningActionLabel = actionMode === 'review'
    ? `오늘 복습 ${songDeckDetail?.dueCount ?? 0}개`
    : actionMode === 'preparing' ? '학습 준비 중' : '학습 시작';
  const learningActionIcon: keyof typeof Feather.glyphMap = actionMode === 'review'
    ? 'rotate-ccw'
    : actionMode === 'preparing' ? 'info' : 'layers';
  const isLearningActionDisabled = isStartingLearning
    || actionMode === 'preparing'
    || (songDeckDetail?.deckId == null && currentTier == null && defaultDeckWords.length === 0);
  const totalWords = words.wordSummary.totalCandidateCount ?? words.words.length;
  const masteredWords = songDeckDetail?.masteredCount ?? 0;
  const studyingWords = songDeckDetail?.studyingCount ?? 0;
  const newWords = songDeckDetail?.newWordCount ?? Math.max(0, totalWords - masteredWords - studyingWords);
  const learningProgress = {
    total: totalWords,
    mastered: masteredWords,
    studying: studyingWords,
    newWords,
  };

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.artworkBackdrop}>
        <Animated.View
          style={[
            styles.artworkBackdropImageFrame,
            { transform: [{ translateY: artworkTranslate }] },
          ]}
        >
          {song.artworkUrl ? (
            <ImageBackground source={{ uri: song.artworkUrl }} style={styles.artworkBackdropImage} resizeMode="cover" />
          ) : (
            <View style={[styles.artworkBackdropImage, styles.heroFallback]} />
          )}
        </Animated.View>
        <View style={styles.artworkBackdropScrim} />
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: activeTab === 'words' ? 0 : bottomReserve },
        ]}
      >
        <View style={styles.hero} />

        <View style={styles.bodyContent}>
          <SongDetailTabs
            activeTab={activeTab}
            tabProgress={tabProgress}
            onSelectHome={handleSelectHome}
            onSelectWords={handleSelectWords}
          />

          {isSongAnalysisPending ? (
            <SongDetailAnalysisPendingPlaceholder onRefresh={handleRefreshAnalysisStatus} />
          ) : (
            <Animated.View style={[styles.tabContentViewport, tabViewportHeight > 0 && { height: tabViewportHeight }]}>
              <Animated.View
                style={[
                  styles.tabContentRail,
                  {
                    width: screenWidth * 2,
                    transform: [{ translateX: tabContentTranslate }],
                  },
                ]}
              >
                <View
                  pointerEvents={activeTab === 'home' ? 'auto' : 'none'}
                  style={[styles.tabPage, { width: screenWidth }]}
                  onLayout={handleHomePageLayout}
                >
                  <SongDetailHomeTab
                    words={words.words}
                    progress={learningProgress}
                    tiers={songTiers}
                    isStartingLearning={isStartingLearning}
                    onViewAllWordsPress={handleSelectWords}
                    onStartTier={handleStartTier}
                  />
                </View>
                <View
                  pointerEvents={activeTab === 'words' ? 'auto' : 'none'}
                  style={[styles.tabPage, { width: screenWidth }]}
                  onLayout={handleWordsPageLayout}
                >
                  <SongDetailWordsTab
                    state={wordsTabState}
                    bottomPadding={WORDS_TAB_BOTTOM_CLEARANCE}
                    busyWordKey={busyWordKey}
                    onStartWordReview={handleStartWordReview}
                  />
                </View>
              </Animated.View>
            </Animated.View>
          )}

        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents={isPinnedTabsVisible ? 'none' : 'box-none'}
        style={[
          styles.heroInfoLayer,
          {
            opacity: heroTextOpacity,
            transform: [{ translateY: heroTextTranslate }],
          },
        ]}
      >
        <View style={styles.heroInfo}>
          <Text style={styles.heroTitle} numberOfLines={2}>{song.title}</Text>
          <Text style={styles.heroArtist} numberOfLines={1}>{song.artist}</Text>
          <Pressable
            style={[styles.deckButton, isLearningActionDisabled && styles.disabledButton]}
            onPress={handlePrimaryLearningPress}
            disabled={isLearningActionDisabled}
          >
            <LearningActionIcon icon={learningActionIcon} size={18} color={Colors.textPrimary} />
            <Text style={styles.deckButtonText}>{learningActionLabel}</Text>
          </Pressable>
        </View>
      </Animated.View>

      <PlaybackOverlays
        title={song.title}
        artist={song.artist}
        youtubeUrl={song.youtubeUrl}
        initialSeekMs={route.params?.initialSeekMs}
        initialLyricIndex={route.params?.initialLyricIndex}
        bottomInset={insets.bottom}
        lines={lyrics.lines}
        words={words.words}
        lineWordIndexes={words.lineWordIndexes}
        lyricType={song.lyricType}
        busyWordKey={busyWordKey}
        onStartWordReview={handleStartWordReview}
      />

      <View
        pointerEvents="none"
        style={[styles.bottomSafeAreaBackground, { height: insets.bottom }]}
      />

      <View
        pointerEvents="none"
        style={[styles.appBarBackdrop, { height: collapsedBarFullHeight }]}
      >
        <Animated.View
          style={[
            styles.artworkBackdropImageFrame,
            { transform: [{ translateY: artworkTranslate }] },
          ]}
        >
          {song.artworkUrl ? (
            <ImageBackground source={{ uri: song.artworkUrl }} style={styles.artworkBackdropImage} resizeMode="cover" />
          ) : (
            <View style={[styles.artworkBackdropImage, styles.heroFallback]} />
          )}
        </Animated.View>
        <View style={styles.artworkBackdropScrim} />
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.appBar,
          { height: collapsedBarFullHeight, paddingTop: insets.top },
        ]}
      >
        <View pointerEvents="box-none" style={styles.appBarContent}>
          <IconButton icon="chevron-left" onPress={handleBack} />

          <Animated.View
            pointerEvents="none"
            style={[
              styles.appBarTitleContent,
              {
                opacity: appBarContentOpacity,
                transform: [{ translateY: appBarContentTranslate }],
              },
            ]}
          >
            <View style={styles.appBarTitleBlock}>
              <Text style={styles.appBarTitle} numberOfLines={1}>{song.title}</Text>
              <Text style={styles.appBarArtist} numberOfLines={1}>{song.artist}</Text>
            </View>
          </Animated.View>

          <View pointerEvents="box-none" style={styles.appBarActions}>
            <Animated.View
              pointerEvents={isPinnedTabsVisible ? 'auto' : 'none'}
              style={{ opacity: appBarContentOpacity }}
            >
              <Pressable
                style={[styles.appBarDeckButton, isLearningActionDisabled && styles.disabledButton]}
                onPress={handlePrimaryLearningPress}
                disabled={isLearningActionDisabled}
              >
                <LearningActionIcon icon={learningActionIcon} size={13} color={Colors.textPrimary} />
                <Text style={styles.appBarDeckButtonText} numberOfLines={1}>{learningActionLabel}</Text>
              </Pressable>
            </Animated.View>
            <IconButton icon="info" onPress={handleOpenInfo} />
          </View>
        </View>
      </View>

      <Animated.View
        pointerEvents={isPinnedTabsVisible ? 'auto' : 'none'}
        style={[
          styles.pinnedTabBar,
          {
            top: insets.top + COLLAPSED_BAR_HEIGHT,
            opacity: pinnedTabsOpacity,
          },
        ]}
      >
        <SongDetailTabs
          activeTab={activeTab}
          tabProgress={tabProgress}
          onSelectHome={handleSelectHome}
          onSelectWords={handleSelectWords}
        />
      </Animated.View>

      {activeTab === 'words' && !isSongAnalysisPending && (
        <Animated.View
          pointerEvents={isPinnedTabsVisible ? 'auto' : 'none'}
          style={[
            styles.pinnedWordsActionBar,
            {
              top: insets.top + COLLAPSED_BAR_HEIGHT + TAB_BAR_HEIGHT,
              opacity: pinnedTabsOpacity,
            },
          ]}
        >
          <SongDetailWordsActionBar state={wordsTabState} />
        </Animated.View>
      )}

      <AppBottomSheet
        ref={infoSheetRef}
        variant="floating"
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        onChange={handleInfoSheetChange}
      >
        <AppBottomSheetView>
          <SongInfoSheet
            songId={song.id}
            title={song.title}
            artist={song.artist}
            lyricsSourceName={lyrics.lyricsSourceName}
            lyricsSourceUrl={lyrics.lyricsSourceUrl}
          />
        </AppBottomSheetView>
      </AppBottomSheet>

      <ErrorDialog message={learningError} onDismiss={handleDismissLearningError} />

    </View>
  );
}

interface PlaybackOverlaysProps {
  title: string;
  artist: string;
  youtubeUrl: string | null;
  initialSeekMs?: number;
  initialLyricIndex?: number;
  bottomInset: number;
  lines: React.ComponentProps<typeof CurrentPlayingWordsSheet>['lines'];
  words: React.ComponentProps<typeof CurrentPlayingWordsSheet>['words'];
  lineWordIndexes: Record<string, number[]>;
  lyricType: React.ComponentProps<typeof CurrentPlayingWordsSheet>['lyricType'];
  busyWordKey: string | null;
  onStartWordReview: React.ComponentProps<typeof CurrentPlayingWordsSheet>['onStartWordReview'];
}

const PlaybackOverlays = React.memo(function PlaybackOverlays({
  title,
  artist,
  youtubeUrl,
  initialSeekMs,
  initialLyricIndex,
  bottomInset,
  lines,
  words,
  lineWordIndexes,
  lyricType,
  busyWordKey,
  onStartWordReview,
}: PlaybackOverlaysProps) {
  const mvBarRef = useRef<SongDetailMvBarRef>(null);
  const wordsSheetRef = useRef<AppBottomSheetRef>(null);
  const wordsSheetIndexRef = useRef(0);
  const currentMs = usePlayerStore(s => s.currentMs);
  const durationMs = usePlayerStore(s => s.durationMs);
  const setCurrentMs = usePlayerStore(s => s.setCurrentMs);
  const setDurationMs = usePlayerStore(s => s.setDurationMs);
  const handleSyncedPageChange = useCallback((line: React.ComponentProps<typeof CurrentPlayingWordsSheet>['lines'][number]) => {
    if (line.startTimeMs == null) return;
    mvBarRef.current?.seekToMs(line.startTimeMs);
    setCurrentMs(line.startTimeMs);
  }, [setCurrentMs]);
  const handleWordsSheetChange = useCallback((index: number) => {
    wordsSheetIndexRef.current = index;
  }, []);
  const handleToggleWordsSheet = useCallback(() => {
    const nextIndex = wordsSheetIndexRef.current === 1 ? 0 : 1;
    wordsSheetIndexRef.current = nextIndex;
    wordsSheetRef.current?.snapToIndex(nextIndex);
  }, []);
  const mvBarHeader = useMemo(() => (
    <SongDetailMvBar
      ref={mvBarRef}
      title={title}
      artist={artist}
      youtubeUrl={youtubeUrl}
      initialSeekMs={initialSeekMs}
      currentTimeMs={currentMs}
      durationMs={durationMs}
      embedded
      onCurrentTimeChange={setCurrentMs}
      onDurationChange={setDurationMs}
      onBarPress={handleToggleWordsSheet}
    />
  ), [
    artist,
    currentMs,
    durationMs,
    handleToggleWordsSheet,
    initialSeekMs,
    setCurrentMs,
    setDurationMs,
    title,
    youtubeUrl,
  ]);

  return (
    <CurrentPlayingWordsSheet
      ref={wordsSheetRef}
      lines={lines}
      words={words}
      lineWordIndexes={lineWordIndexes}
      lyricType={lyricType}
      currentTimeMs={currentMs}
      fallbackLineIndex={initialLyricIndex}
      bottomInset={bottomInset}
      header={mvBarHeader}
      headerHeight={SONG_DETAIL_MV_BAR_HEIGHT}
      busyWordKey={busyWordKey}
      onStartWordReview={onStartWordReview}
      onSheetChange={handleWordsSheetChange}
      onSyncedPageChange={handleSyncedPageChange}
    />
  );
});

interface IconButtonProps {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  dark?: boolean;
}

const IconButton = React.memo(function IconButton({ icon, onPress, dark = false }: IconButtonProps) {
  return (
    <Pressable
      style={[styles.iconButton, dark ? styles.iconButtonLight : styles.iconButtonDark]}
      onPress={onPress}
      hitSlop={8}
    >
      <Feather name={icon} size={22} color={dark ? Colors.textPrimary : '#FFFFFF'} />
    </Pressable>
  );
});

interface TabsProps {
  activeTab: DetailTab;
  tabProgress: Animated.Value;
  onSelectHome: () => void;
  onSelectWords: () => void;
}

const SongDetailTabs = React.memo(function SongDetailTabs({
  activeTab,
  tabProgress,
  onSelectHome,
  onSelectWords,
}: TabsProps) {
  const indicatorTranslateX = useMemo(
    () => tabProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, TAB_ITEM_WIDTH + TAB_ITEM_GAP],
      extrapolate: 'clamp',
    }),
    [tabProgress],
  );

  return (
    <View style={styles.tabBar}>
      <Animated.View
        pointerEvents="none"
        style={[styles.tabIndicator, { transform: [{ translateX: indicatorTranslateX }] }]}
      />
      <TabButton
        tab="home"
        label="홈"
        isActive={activeTab === 'home'}
        tabProgress={tabProgress}
        onPress={onSelectHome}
      />
      <TabButton
        tab="words"
        label="단어"
        isActive={activeTab === 'words'}
        tabProgress={tabProgress}
        onPress={onSelectWords}
      />
    </View>
  );
});

interface TabButtonProps {
  tab: DetailTab;
  label: string;
  isActive: boolean;
  tabProgress: Animated.Value;
  onPress: () => void;
}

const TabButton = React.memo(function TabButton({
  tab,
  label,
  isActive,
  tabProgress,
  onPress,
}: TabButtonProps) {
  const activeOpacity = useMemo(
    () => tabProgress.interpolate({
      inputRange: [0, 1],
      outputRange: tab === 'home' ? [1, 0] : [0, 1],
      extrapolate: 'clamp',
    }),
    [tab, tabProgress],
  );
  const inactiveOpacity = useMemo(
    () => tabProgress.interpolate({
      inputRange: [0, 1],
      outputRange: tab === 'home' ? [0, 1] : [1, 0],
      extrapolate: 'clamp',
    }),
    [tab, tabProgress],
  );
  const labelScale = useMemo(
    () => tabProgress.interpolate({
      inputRange: [0, 1],
      outputRange: tab === 'home' ? [1, 0.96] : [0.96, 1],
      extrapolate: 'clamp',
    }),
    [tab, tabProgress],
  );

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={styles.tabButton}
      onPress={onPress}
    >
      <Animated.Text
        style={[
          styles.tabLabel,
          {
            opacity: inactiveOpacity,
            transform: [{ scale: labelScale }],
          },
        ]}
      >
        {label}
      </Animated.Text>
      <Animated.Text
        style={[
          styles.tabLabel,
          styles.tabLabelActive,
          styles.tabLabelOverlay,
          {
            opacity: activeOpacity,
            transform: [{ scale: labelScale }],
          },
        ]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
});

interface LearningActionIconProps {
  icon: keyof typeof Feather.glyphMap;
  size: number;
  color: string;
}

const LearningActionIcon = React.memo(function LearningActionIcon({
  icon,
  size,
  color,
}: LearningActionIconProps) {
  if (icon !== 'layers') {
    return <Feather name={icon} size={size} color={color} />;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

const SongDetailAnalysisPendingPlaceholder = React.memo(function SongDetailAnalysisPendingPlaceholder({
  onRefresh,
}: {
  onRefresh: () => void;
}) {
  return (
    <View style={styles.analysisPendingWrap}>
      <View style={styles.analysisPendingIconWrap}>
        <FontAwesome6 name="wand-sparkles" size={23} color={Colors.primary} />
      </View>

      <View style={styles.analysisPendingTextBlock}>
        <Text style={styles.analysisPendingTitle}>단어를 준비하는 중이에요</Text>
        <Text style={styles.analysisPendingBody}>
          보통 2~3분 걸려요.{'\n'}
          완료되면 알림으로 알려드릴게요.
        </Text>
      </View>

      <Pressable
        style={styles.analysisPendingRefreshButton}
        onPress={onRefresh}
        accessibilityRole="button"
        accessibilityLabel="분석 상태 새로고침"
      >
        <Feather name="refresh-cw" size={13} color={Colors.textMuted} />
        <Text style={styles.analysisPendingRefreshText}>상태 새로고침</Text>
      </Pressable>
    </View>
  );
});

interface SongDetailLoadingSkeletonProps {
  topInset: number;
  bottomReserve: number;
  collapsedBarFullHeight: number;
  onBack: () => void;
}

const SongDetailLoadingSkeleton = React.memo(function SongDetailLoadingSkeleton({
  topInset,
  bottomReserve,
  collapsedBarFullHeight,
  onBack,
}: SongDetailLoadingSkeletonProps) {
  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={[styles.artworkBackdrop, styles.skeletonArtworkBackdrop]}>
        <View style={styles.skeletonArtworkGlow} />
        <View style={styles.artworkBackdropScrim} />
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomReserve },
        ]}
      >
        <View style={styles.hero} />

        <View style={styles.bodyContent}>
          <View style={styles.tabBar}>
            <View style={styles.tabButton}>
              <SkeletonBox width={26} height={15} borderRadius={4} />
            </View>
            <View style={styles.tabButton}>
              <SkeletonBox width={32} height={15} borderRadius={4} />
            </View>
            <View pointerEvents="none" style={styles.tabIndicator} />
          </View>

          <View style={styles.skeletonHomeContent}>
            <View style={styles.skeletonSection}>
              <View style={styles.skeletonSectionHeader}>
                <SkeletonBox width={78} height={20} borderRadius={5} />
                <SkeletonBox width="58%" height={12} borderRadius={4} />
              </View>

              <View style={styles.skeletonWordList}>
                {SKELETON_WORD_ROWS.map(row => (
                  <View
                    key={row}
                    style={[
                      styles.skeletonWordRow,
                      row !== SKELETON_WORD_ROWS.length - 1 && styles.skeletonWordRowDivider,
                    ]}
                  >
                    <View style={styles.skeletonWordInfo}>
                      <View style={styles.skeletonWordTitleLine}>
                        <SkeletonBox width={row % 2 === 0 ? 72 : 94} height={21} borderRadius={5} />
                        <SkeletonBox width={row % 2 === 0 ? 48 : 64} height={13} borderRadius={4} />
                      </View>
                      <View style={styles.skeletonMeaningLine}>
                        <SkeletonBox width={row === 1 ? '46%' : '61%'} height={13} borderRadius={4} />
                        <SkeletonBox width={38} height={19} borderRadius={7} />
                        <SkeletonBox width={46} height={19} borderRadius={7} />
                      </View>
                    </View>
                    <SkeletonBox width={34} height={34} borderRadius={17} />
                  </View>
                ))}
              </View>

              <View style={styles.skeletonViewAllButton}>
                <SkeletonBox width={112} height={14} borderRadius={5} />
              </View>
            </View>

            <View style={styles.skeletonSection}>
              <SkeletonBox width={54} height={20} borderRadius={5} />
              <View style={styles.skeletonChartBody}>
                <SkeletonBox width={120} height={120} borderRadius={60} />
                <View style={styles.skeletonLegend}>
                  {SKELETON_LEGEND_ROWS.map(row => (
                    <View key={row} style={styles.skeletonLegendRow}>
                      <SkeletonBox width={7} height={7} borderRadius={999} />
                      <SkeletonBox width={row % 2 === 0 ? 64 : 78} height={12} borderRadius={4} />
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>
      </Animated.ScrollView>

      <View pointerEvents="none" style={styles.heroInfoLayer}>
        <View style={styles.heroInfo}>
          <SkeletonBox width="82%" height={40} borderRadius={8} style={styles.skeletonOnDark} />
          <SkeletonBox width="48%" height={17} borderRadius={5} style={styles.skeletonOnDark} />
          <View style={styles.skeletonDeckButton}>
            <SkeletonBox width={142} height={16} borderRadius={5} style={styles.skeletonOnDark} />
          </View>
        </View>
      </View>

      <View pointerEvents="none" style={[styles.appBarBackdrop, { height: collapsedBarFullHeight }, styles.skeletonAppBarBackdrop]}>
        <View style={styles.artworkBackdropScrim} />
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.appBar,
          { height: collapsedBarFullHeight, paddingTop: topInset },
        ]}
      >
        <View pointerEvents="box-none" style={styles.appBarContent}>
          <IconButton icon="chevron-left" onPress={onBack} />
          <View style={styles.appBarTitleContent} />
          <View pointerEvents="none" style={styles.appBarActions}>
            <View style={styles.iconButton} />
          </View>
        </View>
      </View>

      <View pointerEvents="none" style={[styles.skeletonMvBar, { paddingBottom: bottomReserve - SONG_DETAIL_MV_BAR_HEIGHT }]}>
        <View style={styles.skeletonMvContent}>
          <SkeletonBox width={60} height={30} borderRadius={8} />
          <View style={styles.skeletonMvText}>
            <SkeletonBox width="68%" height={14} borderRadius={4} />
            <SkeletonBox width="44%" height={12} borderRadius={4} />
          </View>
          <SkeletonBox width={36} height={36} borderRadius={18} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    backgroundColor: 'transparent',
  },
  artworkBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    zIndex: 0,
    overflow: 'hidden',
    backgroundColor: Colors.textPrimary,
  },
  artworkBackdropImageFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
  },
  artworkBackdropScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000080',
  },
  artworkBackdropImage: {
    ...StyleSheet.absoluteFillObject,
  },
  stateScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Dimens.screenPadding,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  hero: {
    height: HERO_HEIGHT,
    backgroundColor: 'transparent',
  },
  heroFallback: {
    backgroundColor: Colors.textPrimary,
  },
  bodyContent: {
    backgroundColor: Colors.background,
  },
  tabContentViewport: {
    overflow: 'hidden',
  },
  tabContentRail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tabPage: {
    flexShrink: 0,
  },
  heroInfoLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    justifyContent: 'flex-end',
    zIndex: 32,
    elevation: 32,
    paddingBottom: 26,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDark: {
    backgroundColor: '#0000002E',
  },
  iconButtonLight: {
    backgroundColor: Colors.surface,
  },
  heroInfo: {
    gap: 8,
    paddingHorizontal: 22,
  },
  heroTitle: {
    ...Typography.headingExtraBold,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroArtist: {
    ...Typography.bodySemiBold,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFFCC',
    marginBottom: 10,
  },
  deckButton: {
    height: 48,
    marginHorizontal: 2,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF33',
    backgroundColor: '#FFFFFF',
  },
  deckButtonText: {
    ...Typography.bodyBold,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
    color: Colors.textPrimary,
  },
  tabBar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: TAB_ITEM_GAP,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tabButton: {
    width: TAB_ITEM_WIDTH,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    ...Typography.bodyBold,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabLabelActive: {
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  tabLabelOverlay: {
    position: 'absolute',
  },
  tabIndicator: {
    position: 'absolute',
    left: 16 + ((TAB_ITEM_WIDTH - TAB_INDICATOR_WIDTH) / 2),
    bottom: 0,
    width: TAB_INDICATOR_WIDTH,
    height: 2,
    backgroundColor: Colors.primary,
  },
  analysisPendingWrap: {
    minHeight: 580,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 24,
    backgroundColor: Colors.background,
  },
  analysisPendingIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryBg,
  },
  analysisPendingTextBlock: {
    alignItems: 'center',
    gap: 10,
  },
  analysisPendingTitle: {
    ...Typography.headingBold,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  analysisPendingBody: {
    width: 270,
    fontSize: 13,
    lineHeight: 21,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  analysisPendingRefreshButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 9999,
    paddingHorizontal: 10,
  },
  analysisPendingRefreshText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  appBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 35,
  },
  appBarBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    overflow: 'hidden',
    backgroundColor: Colors.textPrimary,
  },
  appBarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    zIndex: 2,
  },
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinnedTabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 12,
  },
  pinnedWordsActionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: WORDS_ACTION_BAR_HEIGHT,
    zIndex: 12,
  },
  bottomSafeAreaBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    zIndex: Layers.currentPlayingWordsSheet - 1,
    elevation: Layers.currentPlayingWordsSheet - 1,
  },
  appBarTitleContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appBarTitleBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  appBarTitle: {
    ...Typography.bodyExtraBold,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  appBarArtist: {
    ...Typography.bodySemiBold,
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFFCC',
  },
  appBarDeckButton: {
    height: 36,
    maxWidth: 136,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF33',
    backgroundColor: '#FFFFFF',
  },
  appBarDeckButtonText: {
    ...Typography.bodyExtraBold,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  disabledButton: {
    opacity: 0.55,
  },
  skeletonArtworkBackdrop: {
    backgroundColor: '#E2E2E2',
  },
  skeletonArtworkGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#D8D8D8',
  },
  skeletonAppBarBackdrop: {
    backgroundColor: '#E2E2E2',
  },
  skeletonOnDark: {
    backgroundColor: '#FFFFFF4D',
  },
  skeletonDeckButton: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF66',
    backgroundColor: '#FFFFFF1F',
  },
  skeletonHomeContent: {
    gap: 28,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  skeletonSection: {
    gap: 12,
  },
  skeletonSectionHeader: {
    gap: 5,
  },
  skeletonWordList: {
    overflow: 'hidden',
  },
  skeletonWordRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  skeletonWordRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  skeletonWordInfo: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  skeletonWordTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skeletonMeaningLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skeletonViewAllButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonChartBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 35,
  },
  skeletonLegend: {
    gap: 8,
  },
  skeletonLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  skeletonMvBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  skeletonMvContent: {
    height: SONG_DETAIL_MV_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  skeletonMvText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
});
