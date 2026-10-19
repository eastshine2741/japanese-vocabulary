import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, ScrollView, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { NavigationState, SceneRendererProps, TabBar, TabDescriptor, TabView } from 'react-native-tab-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import SongProgressRow from '../studyStats/SongProgressRow';
import { SongProgressItem } from '../studyStats/songProgress';
import MemoryProgressBar from '../MemoryProgressBar';
import ProfileAvatar from '../ProfileAvatar';
import CardCollection from '../rewardCards/CardCollection';
import { ArtistRewardCard, SongRewardCard } from '../rewardCards/types';

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

interface Props {
  handle: string;
  displayName: string;
  profileImageUrl: string | null;
  /** 스택에 올린 프로필. 탭의 내 프로필엔 없다. */
  onBack?: () => void;
  /** 내 프로필에만 있다. */
  onOpenSettings?: () => void;
  onEditProfile?: () => void;
  songCards: SongRewardCard[];
  artistCards: ArtistRewardCard[];
  cardsLoading: boolean;
  onPressCard: (card: SongRewardCard) => void;
  onPressArtistCard: (card: ArtistRewardCard) => void;
  onOpenArtistCards: () => void;
  totalWords: number;
  longTermWords: number;
  shortTermWords: number;
  showStatsFallback: boolean;
  songsLoading: boolean;
  representativeSongs: SongProgressItem[];
  onPressSong: (item: SongProgressItem) => void;
  onLongPressSong?: (item: SongProgressItem) => void;
  /** 없으면 곡별 진도 제목만 그리고 전체 목록으로 넘어가지 않는다. */
  onOpenSongProgress?: () => void;
  emptySongsHint?: string;
  heatmap: React.ReactNode;
  contentPaddingBottom: number;
  children?: React.ReactNode;
}

export default function ProfileView({
  handle,
  displayName,
  profileImageUrl,
  onBack,
  onOpenSettings,
  onEditProfile,
  songCards,
  artistCards,
  cardsLoading,
  onPressCard,
  onPressArtistCard,
  onOpenArtistCards,
  totalWords,
  longTermWords,
  shortTermWords,
  showStatsFallback,
  songsLoading,
  representativeSongs,
  onPressSong,
  onLongPressSong,
  onOpenSongProgress,
  emptySongsHint,
  heatmap,
  contentPaddingBottom,
  children,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [tabIndex, setTabIndex] = useState(0);

  const sceneContentStyle = useMemo(() => [styles.sceneContent, { paddingBottom: contentPaddingBottom }], [contentPaddingBottom]);
  const navigationState = useMemo(() => ({ index: tabIndex, routes: PROFILE_TABS }), [tabIndex]);
  const initialLayout = useMemo(() => ({ width: screenWidth }), [screenWidth]);

  // 일반 단어장(songId == null)은 곡 담기 취소 대상이 아니라 롱프레스를 걸지 않는다.
  const songLongPress = useCallback(
    (item: SongProgressItem) => (onLongPressSong && item.songId != null ? onLongPressSong : undefined),
    [onLongPressSong],
  );

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
          onPressCard={onPressCard}
          onPressArtistCard={onPressArtistCard}
          onOpenArtistCards={onOpenArtistCards}
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
              {onOpenSongProgress ? (
                <TouchableOpacity
                  style={styles.songHead}
                  onPress={onOpenSongProgress}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionTitle}>곡별 진도</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <Text style={styles.sectionTitle}>곡별 진도</Text>
              )}
              {songsLoading && representativeSongs.length === 0 ? (
                <ActivityIndicator color={Colors.primary} style={styles.songLoading} />
              ) : representativeSongs.length === 0 ? (
                <View style={styles.emptySongs}>
                  <Text style={styles.emptyTitle}>곡별 진도가 아직 없어요</Text>
                  {emptySongsHint && <Text style={styles.emptyText}>{emptySongsHint}</Text>}
                </View>
              ) : (
                <View>
                  {representativeSongs.map((item) => (
                    <SongProgressRow
                      key={item.deckId}
                      item={item}
                      onPress={onPressSong}
                      onLongPress={songLongPress(item)}
                    />
                  ))}
                </View>
              )}
            </View>
            {heatmap}
          </View>
        </ScrollView>
      )
    ),
    [
      sceneContentStyle, songCards, artistCards, cardsLoading, screenWidth, onPressCard, onPressArtistCard, onOpenArtistCards, totalWords, longTermWords, shortTermWords, showStatsFallback,
      onOpenSongProgress, songsLoading, representativeSongs, onPressSong, songLongPress, heatmap, emptySongsHint,
    ],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.profHeader}>
          <View style={styles.handleRow}>
            {onBack && (
              <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
                <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
              </Pressable>
            )}
            <Text style={styles.handle} numberOfLines={1}>{handle}</Text>
          </View>
          {onOpenSettings && (
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={onOpenSettings}
              activeOpacity={0.7}
            >
              <Feather name="menu" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.profileCard}>
          <ProfileAvatar url={profileImageUrl} size={56} />
          <View style={styles.nameRow}>
            <Text style={styles.profName}>{displayName}</Text>
          </View>
          {onEditProfile && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={onEditProfile}
              activeOpacity={0.7}
            >
              <Feather name="edit-2" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
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
      {children}
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
  handleRow: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // 아이콘 여백만큼 왼쪽으로 빼야 화살표가 아바타와 맞는다.
  backBtn: {
    width: 36,
    height: 36,
    marginLeft: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    flexShrink: 1,
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
