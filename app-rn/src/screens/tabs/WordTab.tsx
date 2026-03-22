import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDeckListStore } from '../../stores/deckListStore';
import { flashcardApi } from '../../api/flashcardApi';
import SongListItem from '../../components/SongListItem';
import { SongDeckSummary } from '../../types/deck';
import { FlashcardStatsResponse } from '../../types/flashcard';
import { Colors, Dimens } from '../../theme/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function WordTab() {
  const navigation = useNavigation<Nav>();
  const { status, data, load } = useDeckListStore();
  const [stats, setStats] = useState<FlashcardStatsResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      load();
      flashcardApi.getStats().then(setStats).catch(() => {});
    }, [])
  );

  const avgRetrievability = data?.allDeck.avgRetrievability;

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>단어장</Text>

      {/* 4-quadrant stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <View style={[styles.statsQuadrant, { backgroundColor: Colors.stateLearningBg }]}>
            <Text style={[styles.statsLabel, { color: Colors.stateLearning }]}>학습</Text>
            <Text style={[styles.statsValue, { color: Colors.stateLearning }]}>
              {stats?.learning ?? 0}
            </Text>
          </View>
          <View style={[styles.statsQuadrant, { backgroundColor: Colors.stateReviewBg }]}>
            <Text style={[styles.statsLabel, { color: Colors.stateReview }]}>복습</Text>
            <Text style={[styles.statsValue, { color: Colors.stateReview }]}>
              {stats?.review ?? 0}
            </Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={[styles.statsQuadrant, { backgroundColor: Colors.stateRelearningBg }]}>
            <Text style={[styles.statsLabel, { color: Colors.stateRelearning }]}>재학습</Text>
            <Text style={[styles.statsValue, { color: Colors.stateRelearning }]}>
              {stats?.newCount ?? 0}
            </Text>
          </View>
          <View style={[styles.statsQuadrant, { backgroundColor: Colors.stateRetrievabilityBg }]}>
            <Text style={[styles.statsLabel, { color: Colors.stateRetrievability }]}>
              평균 Retrievability
            </Text>
            <Text style={[styles.statsValue, { color: Colors.stateRetrievability }]}>
              {avgRetrievability != null
                ? `${Math.round(avgRetrievability * 100)}%`
                : '--'}
            </Text>
          </View>
        </View>
      </View>

      {/* Full-width primary button */}
      <TouchableOpacity
        style={styles.allButton}
        onPress={() => navigation.navigate('DeckDetail', { songId: null })}
        activeOpacity={0.7}
      >
        <Text style={styles.allButtonText}>전체 단어장 보기 {'>'}</Text>
      </TouchableOpacity>

      {/* Section label */}
      <Text style={styles.sectionLabel}>노래별 단어장</Text>
    </View>
  );

  const renderDeck = ({ item }: { item: SongDeckSummary }) => (
    <SongListItem
      artworkUrl={item.artworkUrl}
      title={item.title}
      subtitle={`${item.artist} · ${item.wordCount}단어`}
      miniStats={{
        learning: 0,
        review: 0,
        relearning: 0,
        retrievability: item.avgRetrievability,
      }}
      showChevron
      onPress={() => navigation.navigate('DeckDetail', { songId: item.songId })}
    />
  );

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
    <SafeAreaView style={styles.container}>
      <FlatList
        data={data?.songDecks ?? []}
        keyExtractor={(item) => String(item.songId)}
        ListHeaderComponent={renderHeader}
        renderItem={renderDeck}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: Dimens.screenPadding, paddingBottom: Dimens.screenPadding + Dimens.bottomBarHeight + 40 },
  header: { marginBottom: 8 },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1.5,
    marginBottom: 20,
  },

  /* 4-quadrant stats grid */
  statsGrid: {
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statsQuadrant: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
  },
  statsLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsValue: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 4,
  },

  /* Primary action button */
  allButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  allButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },

  /* Section label */
  sectionLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 24,
    marginBottom: 8,
  },
});
