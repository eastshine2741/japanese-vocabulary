import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useDeckListStore } from '../../stores/deckListStore';
import { flashcardApi } from '../../api/flashcardApi';
import SongListItem from '../../components/SongListItem';
import { FlashcardStatsResponse } from '../../types/flashcard';
import { Colors, Dimens } from '../../theme/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function WordTab() {
  const navigation = useNavigation<Nav>();
  const { status, data, load } = useDeckListStore(
    useShallow(s => ({ status: s.status, data: s.data, load: s.load })),
  );
  const [stats, setStats] = useState<FlashcardStatsResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      load();
      flashcardApi.getStats().then(setStats).catch(() => {});
    }, [])
  );

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Stats card */}
      {stats && stats.total > 0 && (() => {
        const total = stats.total;
        const mastered = stats.review;
        const studying = stats.learning;
        const newCount = stats.newCount;
        const due = stats.due;
        const masteredPct = (mastered / total) * 100;
        const studyingPct = (studying / total) * 100;
        const newPct = (newCount / total) * 100;

        return (
          <View style={styles.statsCard}>
            {/* Hero: due count */}
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>복습할 단어</Text>
              <Text style={styles.heroValue}>{due}</Text>
            </View>

            {/* Segmented pipeline bar */}
            <View style={styles.segBar}>
              {masteredPct > 0 && (
                <View style={[styles.segment, { width: `${masteredPct}%`, backgroundColor: Colors.stateReview }]} />
              )}
              {studyingPct > 0 && (
                <View style={[styles.segment, { width: `${studyingPct}%`, backgroundColor: Colors.stateRetrievability }]} />
              )}
              {newPct > 0 && (
                <View style={[styles.segment, { width: `${newPct}%`, backgroundColor: Colors.stateRelearning }]} />
              )}
            </View>

            {/* Pipeline legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.stateReview }]} />
                <Text style={styles.legendText}>외운 단어 {mastered}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.stateRetrievability }]} />
                <Text style={styles.legendText}>외우는 중 {studying}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.stateRelearning }]} />
                <Text style={styles.legendText}>새 단어 {newCount}</Text>
              </View>
            </View>

            {/* Study button */}
            <TouchableOpacity
              style={[styles.studyButton, due === 0 && styles.buttonDisabled]}
              onPress={() => navigation.navigate('Review', {})}
              disabled={due === 0}
              activeOpacity={0.7}
            >
              <Ionicons name="layers-outline" size={20} color="#FFFFFF" />
              <Text style={styles.studyButtonText}>학습하기</Text>
            </TouchableOpacity>

            {/* View all words button */}
            <TouchableOpacity
              style={styles.wordListButton}
              onPress={() => navigation.navigate('DeckWordList', { songId: null })}
              activeOpacity={0.7}
            >
              <Ionicons name="list-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.wordListButtonText}>전체 단어 보기</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

    </View>
  );

  const renderSongDecks = () => {
    const songDecks = data?.songDecks ?? [];
    if (songDecks.length === 0) return null;
    return (
      <View style={styles.songDecksCard}>
        <Text style={styles.sectionLabel}>노래별 단어장</Text>
        {songDecks.map((item) => (
          <SongListItem
            key={item.songId}
            artworkUrl={item.artworkUrl}
            title={item.title}
            subtitle={`${item.artist} · ${item.wordCount}단어`}
            dueCount={item.dueCount}
            showChevron
            onPress={() => navigation.navigate('DeckDetail', { songId: item.songId })}
          />
        ))}
      </View>
    );
  };

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.list}>
        {renderHeader()}
        {renderSongDecks()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 24, paddingBottom: Dimens.bottomBarHeight + 40, gap: 28 },
  header: { marginBottom: 0 },
  /* Stats card */
  statsCard: {
    paddingVertical: 4,
    gap: 16,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  heroLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  heroValue: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  segBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 2,
  },
  segment: {
    height: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  /* Study button */
  studyButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  studyButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },

  /* Word list button */
  wordListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  wordListButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  /* Song decks card */
  songDecksCard: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
});
