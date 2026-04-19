import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import { useHomeStore } from '../../stores/homeStore';
import { usePlayerStore } from '../../stores/playerStore';
import SongCard from '../../components/SongCard';
import SkeletonBox from '../../components/SkeletonLoading';
import { Colors, Dimens } from '../../theme/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { getErrorMessage } from '../../utils/errorMessages';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 9;

export default function HomeTab() {
  const navigation = useNavigation<Nav>();
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const { status, songs, load } = useHomeStore(
    useShallow(s => ({ status: s.status, songs: s.songs, load: s.load })),
  );
  const playerStatus = usePlayerStore(s => s.status);
  const loadById = usePlayerStore(s => s.loadById);

  useFocusEffect(
    useCallback(() => {
      load();
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
            <TouchableOpacity style={styles.searchBar} onPress={() => navigation.navigate('Search')}>
              <Feather name="search" size={18} color={Colors.textMuted} />
              <Text style={styles.searchPlaceholder}>노래 검색...</Text>
            </TouchableOpacity>

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
        {playerStatus === 'loading' && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {/* Error dialog */}
        <Modal visible={errorDialogMessage !== null} transparent animationType="fade" onRequestClose={() => setErrorDialogMessage(null)}>
          <View style={styles.dialogOverlay}>
            <View style={styles.dialog}>
              <Text style={styles.dialogTitle}>문제가 발생했어요</Text>
              <Text style={styles.dialogBody}>{errorDialogMessage}</Text>
              <View style={styles.dialogBtns}>
                <TouchableOpacity
                  style={[styles.dialogBtn, styles.dialogBtnPrimary]}
                  onPress={() => setErrorDialogMessage(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dialogBtnPrimaryText}>확인</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  list: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: Dimens.bottomBarHeight + 80 },
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
  dialogOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dialog: {
    width: 320,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 28,
    paddingBottom: 20,
    gap: 16,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  dialogBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  dialogBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dialogBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogBtnPrimary: { backgroundColor: Colors.primary },
  dialogBtnPrimaryText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
