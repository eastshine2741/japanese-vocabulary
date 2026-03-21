import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useHomeStore } from '../../stores/homeStore';
import { useSearchStore } from '../../stores/searchStore';
import { flashcardApi } from '../../api/flashcardApi';
import SongCard from '../../components/SongCard';
import StatsCard from '../../components/StatsCard';
import SkeletonBox from '../../components/SkeletonLoading';
import { FlashcardStatsResponse } from '../../types/flashcard';
import { Colors, Dimens } from '../../theme/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 9;

export default function HomeTab() {
  const navigation = useNavigation<Nav>();
  const { status, songs, load } = useHomeStore();
  const { analyzeStatus, studyData, loadById } = useSearchStore();
  const [stats, setStats] = useState<FlashcardStatsResponse | null>(null);

  useEffect(() => {
    load();
    flashcardApi.getStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (analyzeStatus === 'success' && studyData) {
      navigation.navigate('Player', { origin: 'Home' });
    }
  }, [analyzeStatus, studyData]);

  const totalPages = Math.ceil(songs.length / PAGE_SIZE);

  // chunk songs into rows of 3
  const rows: typeof songs[] = [];
  for (let i = 0; i < songs.length; i += 3) {
    rows.push(songs.slice(i, i + 3));
  }

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="music" size={32} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>아직 들은 노래가 없어요</Text>
      <Text style={styles.emptySub}>노래를 검색해서 학습을 시작해보세요</Text>
    </View>
  );

  const renderGrid = () => (
    <View style={styles.albumGrid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.gridRow}>
          {row.map((item) => (
            <SongCard
              key={item.id}
              artworkUrl={item.artworkUrl}
              title={item.title}
              artist={item.artist}
              onPress={() => loadById(item.id)}
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

  const renderDots = () => (
    <View style={styles.dotRow}>
      {Array.from({ length: totalPages }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, { backgroundColor: i === 0 ? Colors.primary : Colors.textMuted }]}
        />
      ))}
    </View>
  );

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <View style={{ paddingHorizontal: Dimens.screenPadding }}>
            <View style={styles.headerContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>오늘의 학습</Text>
                <Text style={styles.subtitle}>노래로 배우는 일본어 단어</Text>
              </View>
              <View style={styles.searchBar}>
                <Feather name="search" size={18} color={Colors.textMuted} />
                <Text style={styles.searchPlaceholder}>노래 검색...</Text>
              </View>
            </View>
          </View>
          <View style={styles.skeletonGrid}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <SkeletonBox height={100} borderRadius={10} />
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
            <View style={styles.header}>
              <Text style={styles.title}>오늘의 학습</Text>
              <Text style={styles.subtitle}>노래로 배우는 일본어 단어</Text>
            </View>

            <TouchableOpacity style={styles.searchBar} onPress={() => navigation.navigate('Search')}>
              <Feather name="search" size={18} color={Colors.textMuted} />
              <Text style={styles.searchPlaceholder}>노래 검색...</Text>
            </TouchableOpacity>

            {stats && (
              <StatsCard
                wordCount={stats.total}
                dueToday={stats.due}
                actionLabel="복습 시작하기"
                onAction={() => navigation.navigate('Review', {})}
              />
            )}

            <View style={styles.recentSection}>
              <Text style={styles.sectionTitle}>최근 들은 노래</Text>
              {songs.length === 0 ? renderEmptyState() : (
                <>
                  {renderGrid()}
                  {totalPages > 1 && renderDots()}
                </>
              )}
            </View>
          </View>
        </ScrollView>
        {analyzeStatus === 'loading' && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  headerContainer: { gap: 24 },
  header: { gap: 4 },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1.5,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
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
  recentSection: { gap: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
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
  albumGrid: { gap: 6 },
  gridRow: { flexDirection: 'row', gap: 6 },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
