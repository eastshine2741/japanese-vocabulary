import React, { useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useReviewStore } from '../stores/reviewStore';
import AppTopBar from '../components/AppTopBar';
import FlashcardView from '../components/FlashcardView';
import RatingButtonRow from '../components/RatingButtonRow';
import { Colors, Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

export default function ReviewScreen({ route, navigation }: Props) {
  const songId = route.params?.songId ?? undefined;
  const {
    status, cards, currentIndex, isRevealed, totalCount,
    stats, totalReviewed, ratingCounts, error,
    loadDueCards, reveal, rate,
  } = useReviewStore();

  useEffect(() => {
    loadDueCards(songId);
  }, [songId]);

  const handleBack = () => {
    if (songId != null) {
      navigation.navigate('DeckDetail', { songId });
    } else {
      navigation.goBack();
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return <ActivityIndicator size="large" color={Colors.primary} style={styles.center} />;

      case 'error':
        return <Text style={styles.errorText}>{error}</Text>;

      case 'noCards':
        return (
          <View style={styles.center}>
            <Text style={styles.noCardsText}>No cards due</Text>
            {stats && (
              <Text style={styles.statsText}>
                {stats.total} total cards
              </Text>
            )}
          </View>
        );

      case 'reviewing': {
        const card = cards[currentIndex];
        const progress = totalCount > 0 ? (currentIndex + 1) / totalCount : 0;
        return (
          <View style={styles.reviewContent}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {currentIndex + 1} / {totalCount}
            </Text>
            <FlashcardView card={card} isRevealed={isRevealed} onReveal={reveal} />
            {isRevealed && (
              <View style={styles.ratingRow}>
                <RatingButtonRow intervals={card.intervals} onRate={rate} />
              </View>
            )}
          </View>
        );
      }

      case 'summary':
        return (
          <View style={styles.center}>
            <Text style={styles.summaryTitle}>Review Complete!</Text>
            <Text style={styles.summaryCount}>{totalReviewed} cards reviewed</Text>
            <View style={styles.ratingsSummary}>
              {[
                { label: 'Again', count: ratingCounts[1], color: Colors.ratingAgain },
                { label: 'Hard', count: ratingCounts[2], color: Colors.ratingHard },
                { label: 'Good', count: ratingCounts[3], color: Colors.ratingGood },
                { label: 'Easy', count: ratingCounts[4], color: Colors.ratingEasy },
              ].map((r) => (
                <View key={r.label} style={styles.ratingStat}>
                  <Text style={[styles.ratingCount, { color: r.color }]}>{r.count}</Text>
                  <Text style={styles.ratingLabel}>{r.label}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.doneButton} onPress={handleBack} activeOpacity={0.7}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <AppTopBar title="Review" onBack={handleBack} />
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Dimens.screenPadding },
  errorText: { color: Colors.ratingAgain, textAlign: 'center', padding: 20 },
  noCardsText: { fontSize: 20, fontWeight: '600', color: Colors.textPrimary },
  statsText: { fontSize: 14, color: Colors.textSecondary, marginTop: 8 },
  reviewContent: { flex: 1, padding: Dimens.screenPadding },
  progressBar: {
    height: 4,
    backgroundColor: Colors.cardBorder,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  progressText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  ratingRow: { marginTop: 20 },
  summaryTitle: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  summaryCount: { fontSize: 16, color: Colors.textSecondary, marginTop: 8 },
  ratingsSummary: { flexDirection: 'row', gap: 20, marginTop: 24 },
  ratingStat: { alignItems: 'center' },
  ratingCount: { fontSize: 24, fontWeight: '700' },
  ratingLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  doneButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginTop: 32,
  },
  doneButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
});
