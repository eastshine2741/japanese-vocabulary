import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useReviewStore } from '../stores/reviewStore';
import FlashcardBackDetails from '../components/FlashcardView';
import RatingButtonRow from '../components/RatingButtonRow';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

const ACTION_ROW_HEIGHT = 48;

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
    if (status === 'summary') {
      navigateToMain();
      return;
    }
    navigation.goBack();
  };

  const navigateToMain = () => {
    navigation.navigate('Main');
  };

  // Android hardware back button: navigate to Main on summary screen
  useFocusEffect(
    useCallback(() => {
      if (status !== 'summary') return;
      const onBackPress = () => {
        navigateToMain();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [status])
  );

  const renderTopNav = () => {
    return (
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} hitSlop={8}>
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            {renderTopNav()}
            <ActivityIndicator size="large" color={Colors.primary} style={styles.center} />
          </>
        );

      case 'error':
        return (
          <>
            {renderTopNav()}
            <Text style={styles.errorText}>{error}</Text>
          </>
        );

      case 'noCards':
        return (
          <>
            {renderTopNav()}
            <View style={styles.center}>
              <Text style={styles.noCardsText}>복습할 카드가 없어요</Text>
              {stats && (
                <Text style={styles.statsText}>전체 {stats.total}장</Text>
              )}
            </View>
          </>
        );

      case 'reviewing': {
        const card = cards[currentIndex];
        const progress = totalCount > 0 ? (currentIndex + 1) / totalCount : 0;
        return (
          <>
            {renderTopNav()}

            {/*
              Layout structure (all three sections are siblings):
              1. cardArea (flex:1) = topSpacer(flex:1) + kanji + bottomSpacer(flex:1)
                 → kanji is always at exactly 50% of this area
              2. progressSection (fixed height) = "n / m" + bar
                 → always at the same position
              3. actionRow (fixed height) = hint text OR rating buttons
                 → variable content but fixed height, so nothing above shifts
            */}

            <Pressable
              style={styles.cardArea}
              onPress={!isRevealed ? reveal : undefined}
              disabled={isRevealed}
            >
              {/* Top spacer: pushes kanji to vertical center */}
              <View style={styles.spacer} />

              {/* Kanji: always rendered here, never moves */}
              <View style={styles.kanjiContainer}>
                <Text style={styles.kanjiText}>{card.japanese}</Text>
              </View>

              {/* Bottom spacer: mirrors top spacer for centering */}
              <View style={styles.spacer}>
                {isRevealed && (
                  <ScrollView
                    contentContainerStyle={styles.backDetails}
                    showsVerticalScrollIndicator={false}
                  >
                    <FlashcardBackDetails card={card} />
                  </ScrollView>
                )}
              </View>
            </Pressable>

            {/* Progress: fixed position, never moves */}
            <View style={styles.progressSection}>
              <Text style={styles.progressCount}>
                {currentIndex + 1} / {totalCount}
              </Text>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
              </View>
            </View>

            {/* Action row: fixed height, content swaps but size stays same */}
            <View style={styles.actionRow}>
              {!isRevealed ? (
                <Text style={styles.hintText}>탭하여 뒷면 보기</Text>
              ) : (
                <RatingButtonRow intervals={card.intervals} onRate={rate} />
              )}
            </View>
          </>
        );
      }

      case 'summary':
        return (
          <>
            {renderTopNav()}

            <View style={styles.center}>
              <View style={styles.celebrationGroup}>
                <View style={styles.checkCircle}>
                  <Feather name="check" size={40} color={Colors.primary} />
                </View>
                <Text style={styles.completeTitle}>학습 완료!</Text>
                <Text style={styles.completeSubtitle}>오늘의 복습을 모두 마쳤어요</Text>
              </View>

              <View style={styles.resultsCard}>
                <Text style={styles.resultsHeader}>학습 결과</Text>
                <View style={styles.divider} />
                {[
                  { label: '전체 카드', count: totalReviewed, color: Colors.textPrimary },
                  { label: '쉬움', count: ratingCounts[4], color: Colors.ratingEasy },
                  { label: '보통', count: ratingCounts[3], color: Colors.ratingGood },
                  { label: '어려움', count: ratingCounts[2], color: Colors.ratingHard },
                  { label: '다시', count: ratingCounts[1], color: Colors.ratingAgain },
                ].map((row) => (
                  <View key={row.label} style={styles.resultRow}>
                    <Text style={styles.resultLabel}>{row.label}</Text>
                    <Text style={[styles.resultCount, { color: row.color }]}>
                      {row.count}장
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.bottomBtnArea}>
              <TouchableOpacity style={styles.homeBtn} onPress={navigateToMain} activeOpacity={0.8}>
                <Text style={styles.homeBtnText}>홈으로 돌아가기</Text>
              </TouchableOpacity>
            </View>
          </>
        );
    }
  };

  return <SafeAreaView style={styles.container}>{renderContent()}</SafeAreaView>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Top nav
  topNav: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },

  // Shared
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    padding: 20,
  },
  errorText: {
    color: Colors.ratingAgain,
    textAlign: 'center',
    padding: 20,
  },
  noCardsText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statsText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },

  // Card area: kanji centered via equal flex spacers
  cardArea: {
    flex: 1,
  },
  spacer: {
    flex: 1,
    overflow: 'hidden',
  },
  kanjiContainer: {
    alignItems: 'center',
  },
  kanjiText: {
    fontSize: 56,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  backDetails: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  // Progress section: fixed position
  progressSection: {
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 20,
  },
  progressCount: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: Colors.elevated,
    borderRadius: 2,
    width: '100%',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },

  // Action row: fixed height
  actionRow: {
    height: ACTION_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 24,
  },
  hintText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // Summary
  celebrationGroup: {
    alignItems: 'center',
    gap: 16,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  completeSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  resultsCard: {
    width: 280,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    gap: 20,
  },
  resultsHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: '#D4D4D8',
    width: '100%',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resultCount: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Bottom button
  bottomBtnArea: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  homeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  homeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
