import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { useSongDetailStore } from '../stores/songDetailStore';
import { usePlayerStore } from '../stores/playerStore';
import { deckApi } from '../api/deckApi';
import { wordApi } from '../api/wordApi';
import SongInfoSheet from '../components/SongInfoSheet';
import { AppBottomSheet, AppBottomSheetRef } from '../components/bottomSheet';
import {
  CurrentPlayingWordsSheet,
  SongDetailHomeTab,
  SONG_DETAIL_MV_BAR_HEIGHT,
  SongDetailMvBar,
  SongDetailWordsTab,
} from '../components/songDetail';
import { Colors, Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SongDetail'>;
type DetailTab = 'home' | 'words';

const HERO_HEIGHT = 360;
const COLLAPSED_BAR_HEIGHT = 56;
const TAB_BAR_HEIGHT = 44;
const TAB_ITEM_WIDTH = 54;
const TAB_ITEM_GAP = 10;
const TAB_INDICATOR_WIDTH = 28;
const TAB_TRANSITION_MS = 260;
const HERO_SCROLL_COLLAPSE_START = HERO_HEIGHT - COLLAPSED_BAR_HEIGHT - TAB_BAR_HEIGHT - 34;
const HERO_SCROLL_COLLAPSE_END = HERO_SCROLL_COLLAPSE_START + 56;
const ARTWORK_COLLAPSED_OFFSET = HERO_HEIGHT * 0.4;

export default function SongDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const scrollY = useRef(new Animated.Value(0)).current;
  const tabProgress = useRef(new Animated.Value(0)).current;
  const infoSheetRef = useRef<AppBottomSheetRef>(null);
  const infoSheetOpenRef = useRef(false);

  const status = useSongDetailStore(s => s.status);
  const data = useSongDetailStore(s => s.data);
  const errorCode = useSongDetailStore(s => s.errorCode);
  const load = useSongDetailStore(s => s.load);
  const refreshWords = useSongDetailStore(s => s.refreshWords);
  const preloadedStudyData = usePlayerStore(s => s.studyData);
  const setCurrentMs = usePlayerStore(s => s.setCurrentMs);
  const setDurationMs = usePlayerStore(s => s.setDurationMs);

  const [activeTab, setActiveTab] = useState<DetailTab>('home');
  const [vocabDeckId, setVocabDeckId] = useState<number | null>(null);
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [isPinnedTabsVisible, setIsPinnedTabsVisible] = useState(false);
  const [tabPageHeights, setTabPageHeights] = useState<Record<DetailTab, number>>({
    home: 0,
    words: 0,
  });
  const isPinnedTabsVisibleRef = useRef(false);

  const routeSongId = route.params?.songId;
  const fallbackSongId = preloadedStudyData?.song.id;
  const songId = routeSongId ?? fallbackSongId;

  useEffect(() => {
    if (songId == null) return;
    setCurrentMs(route.params?.initialSeekMs ?? 0);
    setDurationMs(0);
    load(songId);
  }, [load, route.params?.initialSeekMs, setCurrentMs, setDurationMs, songId]);

  useEffect(() => {
    if (songId == null) {
      setVocabDeckId(null);
      return;
    }
    let cancelled = false;
    deckApi.getDeckBySongId(songId)
      .then(deck => {
        if (!cancelled) setVocabDeckId(deck?.deckId ?? null);
      })
      .catch(() => {
        if (!cancelled) setVocabDeckId(null);
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

  const handleOpenDeck = useCallback(async () => {
    if (vocabDeckId != null) {
      navigation.navigate('DeckDetail', { deckId: vocabDeckId });
      return;
    }
    if (songId == null || defaultDeckWords.length === 0 || isCreatingDeck) return;
    setIsCreatingDeck(true);
    try {
      await wordApi.batchAddWords({ words: defaultDeckWords });
      const deck = await deckApi.getDeckBySongId(songId);
      const nextDeckId = deck?.deckId ?? null;
      setVocabDeckId(nextDeckId);
      if (nextDeckId != null) {
        navigation.navigate('DeckDetail', { deckId: nextDeckId });
      }
      await refreshWords(songId).catch(() => undefined);
    } finally {
      setIsCreatingDeck(false);
    }
  }, [defaultDeckWords, isCreatingDeck, navigation, refreshWords, songId, vocabDeckId]);

  const handleSelectHome = useCallback(() => {
    setActiveTab('home');
  }, []);

  const handleSelectWords = useCallback(() => {
    setActiveTab('words');
  }, []);

  const handleWordsChanged = useCallback(() => {
    if (songId == null) return;
    refreshWords(songId).catch(() => undefined);
    deckApi.getDeckBySongId(songId)
      .then(deck => setVocabDeckId(deck?.deckId ?? null))
      .catch(() => setVocabDeckId(null));
  }, [refreshWords, songId]);

  const handleHomePageLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    setTabPageHeights(prev => prev.home === height ? prev : { ...prev, home: height });
  }, []);

  const handleWordsPageLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    setTabPageHeights(prev => prev.words === height ? prev : { ...prev, words: height });
  }, []);

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

  if (songId == null) {
    return (
      <View style={[styles.stateScreen, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>곡 정보를 찾을 수 없어요.</Text>
      </View>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={[styles.stateScreen, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomReserve }]}
      >
        <View style={styles.hero} />

        <View style={styles.bodyContent}>
          <SongDetailTabs
            activeTab={activeTab}
            tabProgress={tabProgress}
            onSelectHome={handleSelectHome}
            onSelectWords={handleSelectWords}
          />

          <Animated.View style={[styles.tabContentViewport, activePageHeight > 0 && { height: activePageHeight }]}>
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
                  onViewAllWordsPress={handleSelectWords}
                />
              </View>
              <View
                pointerEvents={activeTab === 'words' ? 'auto' : 'none'}
                style={[styles.tabPage, { width: screenWidth }]}
                onLayout={handleWordsPageLayout}
              >
                <SongDetailWordsTab
                  isActive={activeTab === 'words'}
                  data={{
                    words: words.words,
                    wordSummary: words.wordSummary,
                    filterDefaults: words.filterDefaults,
                    lineWordIndexes: words.lineWordIndexes,
                  }}
                  bottomPadding={0}
                  onWordsChanged={handleWordsChanged}
                />
              </View>
            </Animated.View>
          </Animated.View>
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
            style={[styles.deckButton, isCreatingDeck && styles.disabledButton]}
            onPress={handleOpenDeck}
            disabled={isCreatingDeck}
          >
            <Feather name="plus" size={17} color="#FFFFFF" />
            <Text style={styles.deckButtonText}>단어장 만들기</Text>
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
                style={[styles.appBarDeckButton, isCreatingDeck && styles.disabledButton]}
                onPress={handleOpenDeck}
                disabled={isCreatingDeck}
              >
                <Feather name="plus" size={13} color="#FFFFFF" />
                <Text style={styles.appBarDeckButtonText} numberOfLines={1}>단어장 만들기</Text>
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

      <AppBottomSheet
        ref={infoSheetRef}
        variant="floating"
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        onChange={handleInfoSheetChange}
      >
        <BottomSheetView>
          <SongInfoSheet
            songId={song.id}
            title={song.title}
            artist={song.artist}
            lyricsSourceName={lyrics.lyricsSourceName}
            lyricsSourceUrl={lyrics.lyricsSourceUrl}
          />
        </BottomSheetView>
      </AppBottomSheet>
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
}: PlaybackOverlaysProps) {
  const currentMs = usePlayerStore(s => s.currentMs);
  const durationMs = usePlayerStore(s => s.durationMs);
  const setCurrentMs = usePlayerStore(s => s.setCurrentMs);
  const setDurationMs = usePlayerStore(s => s.setDurationMs);
  const mvBarHeader = useMemo(() => (
    <SongDetailMvBar
      title={title}
      artist={artist}
      youtubeUrl={youtubeUrl}
      initialSeekMs={initialSeekMs}
      currentTimeMs={currentMs}
      durationMs={durationMs}
      embedded
      onCurrentTimeChange={setCurrentMs}
      onDurationChange={setDurationMs}
    />
  ), [
    artist,
    currentMs,
    durationMs,
    initialSeekMs,
    setCurrentMs,
    setDurationMs,
    title,
    youtubeUrl,
  ]);

  return (
    <CurrentPlayingWordsSheet
      lines={lines}
      words={words}
      lineWordIndexes={lineWordIndexes}
      currentTimeMs={currentMs}
      fallbackLineIndex={initialLyricIndex}
      bottomInset={bottomInset}
      header={mvBarHeader}
      headerHeight={SONG_DETAIL_MV_BAR_HEIGHT}
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
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroArtist: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFFCC',
    marginBottom: 10,
  },
  deckButton: {
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF80',
    backgroundColor: '#FFFFFF26',
  },
  deckButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
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
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  appBarArtist: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFFCC',
  },
  appBarDeckButton: {
    height: 36,
    maxWidth: 136,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF80',
    backgroundColor: '#FFFFFF26',
  },
  appBarDeckButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.55,
  },
});
