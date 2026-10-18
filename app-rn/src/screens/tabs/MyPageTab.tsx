import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Platform, useWindowDimensions } from 'react-native';
import { NavigationState, SceneRendererProps, TabBar, TabDescriptor, TabView } from 'react-native-tab-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../stores/authStore';
import { useDeckListStore } from '../../stores/deckListStore';
import { useHomeChromeStore } from '../../stores/homeChromeStore';
import { useDeleteSongDeck, useSongDeckActionSheet } from '../../hooks/useDeleteSongDeck';
import type { SongDeckTarget } from '../../components/SongDeckActionSheet';
import { Colors, Dimens } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { RootStackParamList } from '../../navigation/AppNavigator';
import HeatmapSection from '../../components/studyStats/HeatmapSection';
import SongProgressRow from '../../components/studyStats/SongProgressRow';
import { SongProgressItem, toSongProgressItem } from '../../components/studyStats/songProgress';
import MemoryProgressBar from '../../components/MemoryProgressBar';
import ProfileAvatar from '../../components/ProfileAvatar';
import { flashcardApi } from '../../api/flashcardApi';
import { FlashcardStatsResponse } from '../../types/flashcard';
import CardCollection from '../../components/rewardCards/CardCollection';
import { previousArtistCard } from '../../components/rewardCards/cardKinds';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import { ArtistRewardCard, SongRewardCard } from '../../components/rewardCards/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
interface ProfileTabRoute {
  key: 'cards' | 'study';
  // 화면에는 아이콘만 그리고 title 은 스크린 리더 라벨로 쓴다.
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}

const PROFILE_TABS: ProfileTabRoute[] = [
  { key: 'cards', title: '카드', icon: 'albums-outline', iconActive: 'albums' },
  { key: 'study', title: '학습', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
];

const TAB_OPTIONS: TabDescriptor<ProfileTabRoute> = {
  label: ({ route, focused }) => (
    <Ionicons
      name={focused ? route.iconActive : route.icon}
      size={22}
      color={focused ? Colors.textPrimary : Colors.textMuted}
    />
  ),
};

function renderTabBar(
  props: SceneRendererProps & {
    navigationState: NavigationState<ProfileTabRoute>;
    options: Record<string, TabDescriptor<ProfileTabRoute>> | undefined;
  },
) {
  return (
    <TabBar
      {...props}
      style={styles.tabBar}
      indicatorStyle={styles.tabIndicator}
      pressColor="transparent"
      pressOpacity={0.72}
    />
  );
}

const SIDE_PADDING = 24;

export default function MyPageTab() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const username = useAuthStore((s) => s.username);
  const userName = useAuthStore((s) => s.userName);
  const profileImageUrl = useAuthStore((s) => s.profileImageUrl);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const songCards = useRewardCardStore((s) => s.songCards);
  const artistCards = useRewardCardStore((s) => s.artistCards);
  const cardsLoading = useRewardCardStore((s) => s.source === 'server' && (s.serverStatus === 'idle' || s.serverStatus === 'loading'));
  const revealCard = useRewardCardStore((s) => s.revealCard);
  const upgradeArtistCard = useRewardCardStore((s) => s.upgradeArtistCard);
  const { deckStatus, songDecks, loadDecks } = useDeckListStore(
    useShallow((s) => ({
      deckStatus: s.status,
      songDecks: s.songDecks,
      loadDecks: s.load,
    })),
  );
  const [flashcardStats, setFlashcardStats] = useState<FlashcardStatsResponse | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadDecks();
      if (useRewardCardStore.getState().source === 'server') useRewardCardStore.getState().loadServerCards();
    }, [loadProfile, loadDecks]),
  );

  const statsAliveRef = useRef(false);
  const loadFlashcardStats = useCallback(() => {
    flashcardApi.getStats()
      .then((data) => {
        if (!statsAliveRef.current) return;
        setFlashcardStats(data);
        setStatsError(null);
      })
      .catch((e: any) => {
        if (!statsAliveRef.current) return;
        setStatsError(e.message ?? 'failed');
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      statsAliveRef.current = true;
      loadFlashcardStats();
      return () => {
        statsAliveRef.current = false;
      };
    }, [loadFlashcardStats]),
  );

  const { width: screenWidth } = useWindowDimensions();
  const [tabIndex, setTabIndex] = useState(0);
  const requestHomeReload = useHomeChromeStore((s) => s.requestReload);
  const handleDeckDeleted = useCallback(() => {
    loadDecks();
    loadFlashcardStats();
    requestHomeReload();
  }, [loadDecks, loadFlashcardStats, requestHomeReload]);
  const deckDeletion = useDeleteSongDeck(handleDeckDeleted);
  const { requestDelete } = deckDeletion;
  const handleDeleteFromSheet = useCallback((target: SongDeckTarget) => {
    requestDelete(target.deckId);
  }, [requestDelete]);
  const deckActions = useSongDeckActionSheet(handleDeleteFromSheet);
  const { open: openDeckActions } = deckActions;

  const handle = username ? `@${username}` : '@user';
  const displayName = userName?.trim() || '학습자';
  const progressItems = useMemo(() => songDecks.map(toSongProgressItem), [songDecks]);
  const representativeSongs = useMemo(() => progressItems.slice(0, 5), [progressItems]);
  const totalWords = flashcardStats?.total ?? sumBy(progressItems, (item) => item.totalWords);
  const longTermWords = flashcardStats?.longTermCount ?? sumBy(progressItems, (item) => item.longTermCount);
  const shortTermWords = flashcardStats?.shortTermCount ?? sumBy(progressItems, (item) => item.shortTermCount);
  const showStatsFallback = !flashcardStats && !!statsError;

  const handleSongProgressPress = useCallback((item: SongProgressItem) => {
    if (item.songId != null) {
      navigation.navigate('SongDetail', { songId: item.songId, origin: 'profile_song_progress' });
    } else {
      navigation.navigate('DeckDetail', { deckId: item.deckId });
    }
  }, [navigation]);

  // 일반 단어장(songId == null)은 곡 담기 취소 대상이 아니라 롱프레스를 걸지 않는다.
  const handleSongProgressLongPress = useCallback((item: SongProgressItem) => {
    openDeckActions({ deckId: item.deckId, title: item.title, artist: item.artist });
  }, [openDeckActions]);

  const handleOpenSongProgress = useCallback(() => {
    navigation.navigate('SongProgressList');
  }, [navigation]);

  const handleOpenStreak = useCallback(() => {
    navigation.navigate('Streak');
  }, [navigation]);

  const handlePressCard = useCallback((card: SongRewardCard) => {
    navigation.navigate('RewardCardDetail', { cardId: card.id, ownerName: displayName });
  }, [navigation, displayName]);

  // 개발 빌드에서만 카드를 길게 눌러 획득 화면을 다시 띄운다.
  const handleLongPressCard = useCallback((card: SongRewardCard) => revealCard('song', card.id), [revealCard]);
  const handleLongPressArtistCard = useCallback(
    (card: ArtistRewardCard) => {
      // 웹 Alert 는 버튼을 띄우지 못한다.
      if (previousArtistCard(card) === null || Platform.OS === 'web') return revealCard('artist', card.id);
      Alert.alert('카드 연출', undefined, [
        { text: '새로 얻기', onPress: () => revealCard('artist', card.id) },
        { text: '등급 오르기', onPress: () => upgradeArtistCard(card.id) },
        { text: '취소', style: 'cancel' },
      ]);
    },
    [revealCard, upgradeArtistCard],
  );

  const handlePressArtistCard = useCallback((card: ArtistRewardCard) => {
    navigation.navigate('ArtistCardDetail', { cardId: card.id, ownerName: displayName });
  }, [navigation, displayName]);

  const handleOpenArtistCards = useCallback(() => {
    navigation.navigate('ArtistCardList', { ownerName: displayName });
  }, [navigation, displayName]);

  const contentPadding = Dimens.bottomBarHeight + insets.bottom + 24;
  const sceneContentStyle = useMemo(() => [styles.sceneContent, { paddingBottom: contentPadding }], [contentPadding]);
  const navigationState = useMemo(() => ({ index: tabIndex, routes: PROFILE_TABS }), [tabIndex]);
  const initialLayout = useMemo(() => ({ width: screenWidth }), [screenWidth]);

  const renderScene = useCallback(
    ({ route }: { route: ProfileTabRoute }) => (
      route.key === 'cards' ? (
        <CardCollection
          songCards={songCards}
          artistCards={artistCards}
          loading={cardsLoading}
          contentWidth={screenWidth - SIDE_PADDING * 2}
          sidePadding={SIDE_PADDING}
          contentContainerStyle={sceneContentStyle}
          onPressCard={handlePressCard}
          onLongPressCard={__DEV__ ? handleLongPressCard : undefined}
          onPressArtistCard={handlePressArtistCard}
          onLongPressArtistCard={__DEV__ ? handleLongPressArtistCard : undefined}
          onOpenArtistCards={handleOpenArtistCards}
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={sceneContentStyle}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.studyTab}>
            <LearningHero
              totalWords={totalWords}
              longTermWords={longTermWords}
              shortTermWords={shortTermWords}
              showFallback={showStatsFallback}
            />
            <View style={styles.songSection}>
              <TouchableOpacity
                style={styles.songHead}
                onPress={handleOpenSongProgress}
                activeOpacity={0.7}
              >
                <Text style={styles.sectionTitle}>곡별 진도</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
              {deckStatus === 'loading' && progressItems.length === 0 ? (
                <ActivityIndicator color={Colors.primary} style={styles.songLoading} />
              ) : representativeSongs.length === 0 ? (
                <View style={styles.emptySongs}>
                  <Text style={styles.emptyTitle}>곡별 진도가 아직 없어요</Text>
                  <Text style={styles.emptyText}>노래에서 단어를 저장하면 여기에 진행률이 보여요</Text>
                </View>
            ) : (
                <View>
                  {representativeSongs.map((item) => (
                    <SongProgressRow
                      key={item.deckId}
                      item={item}
                      onPress={handleSongProgressPress}
                      onLongPress={item.songId != null ? handleSongProgressLongPress : undefined}
                    />
                  ))}
                </View>
              )}
            </View>
            <HeatmapSection onPressMore={handleOpenStreak} />
          </View>
        </ScrollView>
      )
    ),
    [
      sceneContentStyle, songCards, artistCards, cardsLoading, screenWidth, handlePressCard, handleLongPressCard, handlePressArtistCard, handleLongPressArtistCard, handleOpenArtistCards, totalWords, longTermWords, shortTermWords, showStatsFallback,
      handleOpenSongProgress, deckStatus, progressItems.length, representativeSongs, handleSongProgressPress, handleSongProgressLongPress, handleOpenStreak,
    ],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.profHeader}>
          <Text style={styles.handle}>{handle}</Text>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
          >
            <Feather name="menu" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <ProfileAvatar url={profileImageUrl} size={56} />
          <View style={styles.nameRow}>
            <Text style={styles.profName}>{displayName}</Text>
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('ProfileEdit')}
            activeOpacity={0.7}
          >
            <Feather name="edit-2" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <TabView
        navigationState={navigationState}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        commonOptions={TAB_OPTIONS}
        onIndexChange={setTabIndex}
        initialLayout={initialLayout}
      />
      {deckActions.sheet}
      {deckDeletion.dialogs}
    </SafeAreaView>
  );
}

function LearningHero({
  totalWords,
  longTermWords,
  shortTermWords,
  showFallback,
}: {
  totalWords: number;
  longTermWords: number;
  shortTermWords: number;
  showFallback: boolean;
}) {
  const safeTotal = Math.max(0, totalWords);
  const safeLongTerm = Math.min(Math.max(0, longTermWords), safeTotal);
  const caption = safeTotal > 0
    ? `${safeTotal}단어 중 ${safeLongTerm}개를 외웠어요`
    : '저장한 단어가 아직 없어요';
  return (
    <View style={styles.heroBlock}>
      <View style={styles.heroLine}>
        <Text style={styles.heroValue}>{safeLongTerm}</Text>
        <Text style={styles.heroTail}>/ {safeTotal} 단어</Text>
      </View>
      <Text style={styles.heroCaption}>
        {showFallback ? `${caption} · 일부 통계는 곡별 진도로 계산했어요` : caption}
      </Text>
      <MemoryProgressBar
        totalCount={safeTotal}
        longTermCount={safeLongTerm}
        shortTermCount={shortTermWords}
        showLegend
      />
    </View>
  );
}

function sumBy(items: SongProgressItem[], pick: (item: SongProgressItem) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  scrollView: { flex: 1 },
  header: {
    paddingHorizontal: SIDE_PADDING,
  },
  sceneContent: {
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 24,
  },
  tabBar: {
    backgroundColor: Colors.surface,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabIndicator: {
    height: 2,
    backgroundColor: Colors.textPrimary,
  },
  studyTab: {
    gap: 30,
  },

  profHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  handle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  nameRow: {
    flex: 1,
    flexDirection: 'column',
    gap: 3,
  },
  profName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBlock: {
    gap: 10,
  },
  heroLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  heroValue: {
    fontSize: 52,
    lineHeight: 52,
    fontWeight: '800',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  heroTail: {
    marginBottom: 6,
    fontSize: 17,
    lineHeight: 18,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  heroCaption: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  songSection: {
    gap: 14,
  },
  songHead: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  songLoading: {
    paddingVertical: 24,
  },
  emptySongs: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
