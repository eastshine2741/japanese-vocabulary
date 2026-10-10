import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { NavigationState, SceneRendererProps, TabBar, TabDescriptor, TabView } from 'react-native-tab-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../stores/authStore';
import { useDeckListStore } from '../../stores/deckListStore';
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
import { DUMMY_ARTIST_CARDS } from '../../components/rewardCards/dummyRewardCards';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import { ArtistRewardCard, SongRewardCard } from '../../components/rewardCards/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
interface ProfileTabRoute {
  key: 'cards' | 'study';
  title: string;
}

const PROFILE_TABS: ProfileTabRoute[] = [
  { key: 'cards', title: '카드' },
  { key: 'study', title: '학습' },
];

const TAB_OPTIONS: TabDescriptor<ProfileTabRoute> = {
  label: ({ route, focused }) => (
    <Text style={focused ? styles.tabLabelActive : styles.tabLabel}>{route.title}</Text>
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
  const revealCard = useRewardCardStore((s) => s.revealCard);
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
    }, [loadProfile, loadDecks]),
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      flashcardApi.getStats()
        .then((data) => {
          if (!alive) return;
          setFlashcardStats(data);
          setStatsError(null);
        })
        .catch((e: any) => {
          if (!alive) return;
          setStatsError(e.message ?? 'failed');
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  const { width: screenWidth } = useWindowDimensions();
  const [tabIndex, setTabIndex] = useState(0);

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

  const handleOpenSongProgress = useCallback(() => {
    navigation.navigate('SongProgressList');
  }, [navigation]);

  const handleOpenStreak = useCallback(() => {
    navigation.navigate('Streak');
  }, [navigation]);

  const handlePressCard = useCallback((card: SongRewardCard) => {
    navigation.navigate('RewardCardDetail', { cardId: card.id, ownerName: displayName });
  }, [navigation, displayName]);

  // 획득 조건을 아직 서버가 알려 주지 않아, 개발 빌드에서만 카드를 길게 눌러 획득 화면을 띄운다.
  const handleLongPressCard = useCallback((card: SongRewardCard) => revealCard(card.id), [revealCard]);

  const handlePressArtistCard = useCallback((card: ArtistRewardCard) => {
    navigation.navigate('ArtistCardDetail', { cardId: card.id, ownerName: displayName });
  }, [navigation, displayName]);

  const contentPadding = Dimens.bottomBarHeight + insets.bottom + 24;
  const navigationState = useMemo(() => ({ index: tabIndex, routes: PROFILE_TABS }), [tabIndex]);
  const initialLayout = useMemo(() => ({ width: screenWidth }), [screenWidth]);

  const renderScene = useCallback(
    ({ route }: { route: ProfileTabRoute }) => (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.sceneContent, { paddingBottom: contentPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {route.key === 'cards' ? (
          <CardCollection
            songCards={songCards}
            artistCards={DUMMY_ARTIST_CARDS}
            contentWidth={screenWidth - SIDE_PADDING * 2}
            sidePadding={SIDE_PADDING}
            onPressCard={handlePressCard}
            onLongPressCard={__DEV__ ? handleLongPressCard : undefined}
            onPressArtistCard={handlePressArtistCard}
          />
        ) : (
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
                    <SongProgressRow key={item.deckId} item={item} onPress={handleSongProgressPress} />
                  ))}
                </View>
              )}
            </View>
            <HeatmapSection onPressMore={handleOpenStreak} />
          </View>
        )}
      </ScrollView>
    ),
    [
      contentPadding, screenWidth, handlePressCard, handlePressArtistCard, totalWords, longTermWords, shortTermWords, showStatsFallback,
      handleOpenSongProgress, deckStatus, progressItems.length, representativeSongs, handleSongProgressPress, handleOpenStreak,
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
            <Text style={styles.collectionSummary}>
              곡 카드 {songCards.length} · 아티스트 카드 {DUMMY_ARTIST_CARDS.length}
            </Text>
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
  collectionSummary: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  tabBar: {
    backgroundColor: Colors.surface,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabLabel: {
    ...Typography.headingSemiBold,
    fontSize: 15,
    color: Colors.textMuted,
  },
  tabLabelActive: {
    ...Typography.headingBold,
    fontSize: 15,
    color: Colors.textPrimary,
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
