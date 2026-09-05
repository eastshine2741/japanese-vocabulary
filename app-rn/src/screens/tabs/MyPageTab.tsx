import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, BackHandler, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../stores/authStore';
import { useDeckListStore } from '../../stores/deckListStore';
import { AppBottomSheetModal, AppBottomSheetModalRef, AppBottomSheetView } from '../../components/bottomSheet';
import { Colors, Dimens } from '../../theme/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';
import HeatmapSection from '../../components/studyStats/HeatmapSection';
import FreezeInfoSheet from '../../components/studyStats/FreezeInfoSheet';
import SongProgressRow from '../../components/studyStats/SongProgressRow';
import { SongProgressItem, toSongProgressItem } from '../../components/studyStats/songProgress';
import { flashcardApi } from '../../api/flashcardApi';
import { FlashcardStatsResponse } from '../../types/flashcard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MyPageTab() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const username = useAuthStore((s) => s.username);
  const userName = useAuthStore((s) => s.userName);
  const loadProfile = useAuthStore((s) => s.loadProfile);
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

  useEffect(() => {
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
  }, []);

  const freezeSheetRef = useRef<AppBottomSheetModalRef>(null);
  const freezeOpenRef = useRef(false);

  const handleOpenFreeze = useCallback(() => {
    freezeOpenRef.current = true;
    freezeSheetRef.current?.present();
  }, []);

  const handleCloseFreeze = useCallback(() => {
    freezeOpenRef.current = false;
    freezeSheetRef.current?.dismiss();
  }, []);

  const handleFreezeSheetChange = useCallback((index: number) => {
    freezeOpenRef.current = index >= 0;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (freezeOpenRef.current) {
          freezeOpenRef.current = false;
          freezeSheetRef.current?.dismiss();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, []),
  );

  const handle = username ? `@${username}` : '@user';
  const displayName = userName?.trim() || '학습자';
  const progressItems = useMemo(() => songDecks.map(toSongProgressItem), [songDecks]);
  const representativeSongs = useMemo(() => progressItems.slice(0, 2), [progressItems]);
  const totalWords = flashcardStats?.total ?? sumBy(progressItems, (item) => item.totalWords);
  const masteredWords = flashcardStats?.review ?? sumBy(progressItems, (item) => item.masteredCount);
  const learningWords = flashcardStats?.learning ?? sumBy(progressItems, (item) => item.learningCount);
  const newWords = flashcardStats?.newCount ?? sumBy(progressItems, (item) => item.newCount);
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: Dimens.bottomBarHeight + insets.bottom + 40 }]}
      >
        {/* profHeader */}
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

        {/* profileCard */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={Colors.textMuted} />
          </View>
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

        <LearningHero
          totalWords={totalWords}
          masteredWords={masteredWords}
          learningWords={learningWords}
          newWords={newWords}
          showFallback={showStatsFallback}
        />
        <HeatmapSection onPressFreeze={handleOpenFreeze} />
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
      </ScrollView>

      <AppBottomSheetModal
        ref={freezeSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        onChange={handleFreezeSheetChange}
      >
        <AppBottomSheetView>
          <FreezeInfoSheet onConfirm={handleCloseFreeze} />
        </AppBottomSheetView>
      </AppBottomSheetModal>
    </SafeAreaView>
  );
}

function LearningHero({
  totalWords,
  masteredWords,
  learningWords,
  newWords,
  showFallback,
}: {
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  newWords: number;
  showFallback: boolean;
}) {
  const safeTotal = Math.max(0, totalWords);
  const safeMastered = Math.min(Math.max(0, masteredWords), safeTotal);
  const safeLearning = Math.min(Math.max(0, learningWords), Math.max(0, safeTotal - safeMastered));
  const safeNew = Math.min(Math.max(0, newWords), Math.max(0, safeTotal - safeMastered - safeLearning));
  const caption = safeTotal > 0
    ? `${safeTotal}단어 중 ${safeMastered}개를 외웠어요`
    : '저장한 단어가 아직 없어요';
  return (
    <View style={styles.heroBlock}>
      <View style={styles.heroLine}>
        <Text style={styles.heroValue}>{safeMastered}</Text>
        <Text style={styles.heroTail}>/ {safeTotal} 단어</Text>
      </View>
      <Text style={styles.heroCaption}>
        {showFallback ? `${caption} · 일부 통계는 곡별 진도로 계산했어요` : caption}
      </Text>
      <View style={styles.heroTrack}>
        {safeMastered > 0 && <View style={[styles.heroKnown, { flex: safeMastered }]} />}
        {safeLearning > 0 && <View style={[styles.heroLearning, { flex: safeLearning }]} />}
        {safeNew > 0 && <View style={[styles.heroNew, { flex: safeNew }]} />}
      </View>
      <View style={styles.heroLegend}>
        <LegendDot color={Colors.primary} label={`외운 ${safeMastered}`} />
        <LegendDot color={Colors.accentSecondary} label={`학습 중 ${safeLearning}`} />
        <LegendDot color={Colors.freezeStroke} label={`새 단어 ${safeNew}`} />
      </View>
    </View>
  );
}

const LegendDot = React.memo(function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
});

function sumBy(items: SongProgressItem[], pick: (item: SongProgressItem) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  scrollView: { flex: 1 },
  content: {
    paddingHorizontal: 24,
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
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
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
  heroTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#F6F6F6',
    marginTop: 4,
  },
  heroKnown: {
    height: 8,
    backgroundColor: Colors.primary,
  },
  heroLearning: {
    height: 8,
    backgroundColor: Colors.accentSecondary,
  },
  heroNew: {
    height: 8,
    backgroundColor: Colors.freezeStroke,
  },
  heroLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
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
