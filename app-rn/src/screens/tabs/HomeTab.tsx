import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import { useHomeStore } from '../../stores/homeStore';
import { usePlayerStore } from '../../stores/playerStore';
import { flashcardApi } from '../../api/flashcardApi';
import { FlashcardStatsResponse } from '../../types/flashcard';
import SongCard from '../../components/SongCard';
import SkeletonBox from '../../components/SkeletonLoading';
import ErrorDialog from '../../components/ErrorDialog';
import StudyStatsHomeCard from '../../components/studyStats/StudyStatsHomeCard';
import { Colors, Dimens } from '../../theme/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { getErrorMessage } from '../../utils/errorMessages';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 9; // 3x3 per page
const MAX_PAGES = 2;

export default function HomeTab() {
  const navigation = useNavigation<Nav>();
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<FlashcardStatsResponse | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(Dimensions.get('window').width);
  const pageScrollRef = useRef<ScrollView>(null);
  const { status, songs, load } = useHomeStore(
    useShallow(s => ({ status: s.status, songs: s.songs, load: s.load })),
  );
  const loadById = usePlayerStore(s => s.loadById);

  useFocusEffect(
    useCallback(() => {
      load();
      flashcardApi.getStats().then(setStats).catch(() => {});
      setPageIndex(0);
      pageScrollRef.current?.scrollTo({ x: 0, animated: false });
    }, [])
  );

  const handleSongPress = useCallback(async (id: number) => {
    await loadById(id);
    const state = usePlayerStore.getState();
    if (state.status === 'success') {
      navigation.navigate('Player', { origin: 'Home' });
    } else if (state.status === 'error') {
      setErrorDialogMessage(getErrorMessage(state.errorCode));
    }
  }, [loadById, navigation]);

  const visibleSongs = songs.slice(0, PAGE_SIZE * MAX_PAGES);
  const totalPages = Math.min(MAX_PAGES, Math.ceil(visibleSongs.length / PAGE_SIZE));
  const pages: typeof songs[] = [];
  for (let p = 0; p < totalPages; p++) {
    pages.push(visibleSongs.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE));
  }

  const handlePageScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / scrollViewWidth);
    setPageIndex(idx);
  }, [scrollViewWidth]);

  const handleScrollViewLayout = useCallback((e: LayoutChangeEvent) => {
    setScrollViewWidth(e.nativeEvent.layout.width);
  }, []);

  const renderActionCard = () => {
    if (!stats) return null;
    const { due, total } = stats;

    if (due > 0) {
      return (
        <View style={styles.actionCard}>
          <Text style={styles.actionLabel}>복습할 단어 {due}개</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Review', {})}
            activeOpacity={0.7}
          >
            <Ionicons name="layers-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>지금 복습하기</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (total > 0) {
      return (
        <View style={styles.actionCard}>
          <View style={styles.actionDoneRow}>
            <Feather name="check-circle" size={18} color={Colors.stateReview} />
            <Text style={styles.actionLabel}>오늘 복습 완료!</Text>
          </View>
        </View>
      );
    }

    if (songs.length > 0) {
      return (
        <View style={styles.actionCard}>
          <Text style={styles.actionLabel}>노래를 들으며 단어를 저장해보세요</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSongPress(songs[0].id)}
            activeOpacity={0.7}
          >
            <Ionicons name="musical-notes-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>학습하기</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.actionCard}>
        <Text style={styles.actionLabel}>좋아하는 일본 노래로 시작하기</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.7}
        >
          <Feather name="search" size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>노래 검색하기</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="music" size={32} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>아직 들은 노래가 없어요</Text>
      <Text style={styles.emptySub}>노래를 검색해서 학습을 시작해보세요</Text>
    </View>
  );

  const renderPagedGrid = () => (
    <>
      <ScrollView
        ref={pageScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={handleScrollViewLayout}
        onScroll={handlePageScroll}
        scrollEventThrottle={16}
        style={styles.pageScroll}
      >
        {pages.map((pageSongs, pIdx) => {
          const rows: typeof songs[] = [];
          for (let i = 0; i < pageSongs.length; i += 3) {
            rows.push(pageSongs.slice(i, i + 3));
          }
          return (
            <View key={pIdx} style={[styles.gridPage, { width: scrollViewWidth }]}>
              {rows.map((row, rIdx) => (
                <View key={rIdx} style={styles.gridRow}>
                  {row.map((item) => (
                    <SongCard
                      key={item.id}
                      artworkUrl={item.artworkUrl}
                      title={item.title}
                      artist={item.artist}
                      onPress={() => handleSongPress(item.id)}
                    />
                  ))}
                  {row.length < 3 &&
                    Array.from({ length: 3 - row.length }).map((_, i) => (
                      <View key={`empty-${i}`} style={{ flex: 1 }} />
                    ))}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
      {totalPages > 1 && (
        <View style={styles.dotRow}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i === pageIndex ? Colors.primary : Colors.textMuted }]}
            />
          ))}
        </View>
      )}
    </>
  );

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <View style={{ paddingHorizontal: Dimens.screenPadding }}>
            <View style={styles.searchBar}>
              <Feather name="search" size={18} color={Colors.textMuted} />
              <Text style={styles.searchPlaceholder}>노래 검색...</Text>
            </View>
          </View>
          <View style={styles.skeletonGrid}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <SkeletonBox height={100} borderRadius={16} />
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.headerContainer}>
            <TouchableOpacity style={styles.searchBar} onPress={() => navigation.navigate('Search')}>
              <Feather name="search" size={18} color={Colors.textMuted} />
              <Text style={styles.searchPlaceholder}>노래 검색...</Text>
            </TouchableOpacity>

            {renderActionCard()}

            <StudyStatsHomeCard />

            <View style={styles.recentSection}>
              <Text style={styles.sectionTitle}>최근 들은 노래</Text>
              {visibleSongs.length === 0 ? renderEmptyState() : renderPagedGrid()}
            </View>
          </View>
        </ScrollView>

        <ErrorDialog message={errorDialogMessage} onDismiss={() => setErrorDialogMessage(null)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  list: { paddingTop: 20, paddingHorizontal: Dimens.screenPadding, paddingBottom: Dimens.bottomBarHeight + 80 },
  headerContainer: { gap: 24 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.elevated,
    borderRadius: 16,
    height: 48,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchPlaceholder: { fontSize: 14, color: Colors.textMuted },

  /* Action card */
  actionCard: {
    backgroundColor: Colors.elevated,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  actionDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    width: '100%',
    height: 44,
    backgroundColor: Colors.primary,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  /* Recent section */
  recentSection: { gap: 12 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyState: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  pageScroll: {
    marginHorizontal: -Dimens.screenPadding,
  },
  gridPage: {
    gap: 6,
    paddingHorizontal: Dimens.screenPadding,
  },
  gridRow: { flexDirection: 'row', gap: 6 },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Dimens.screenPadding,
    gap: 6,
    marginTop: 24,
  },
  skeletonCard: { width: '31%', aspectRatio: 1 },
});
