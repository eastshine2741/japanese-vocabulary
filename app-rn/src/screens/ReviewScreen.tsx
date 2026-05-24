import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useReviewStore } from '../stores/reviewStore';
import { usePlayerStore } from '../stores/playerStore';
import FlashcardBackDetails from '../components/FlashcardView';
import RatingButtonRow from '../components/RatingButtonRow';
import { AppBar } from '../components/AppBar';
import { PrimaryButton } from '../components/PrimaryButton';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

const ACTION_ROW_HEIGHT = 48;

export default function ReviewScreen({ route, navigation }: Props) {
  const songId = route.params?.songId ?? undefined;
  const {
    status, cards, currentIndex, isRevealed, totalCount,
    stats, error,
    loadDueCards, reveal, rate, refreshCurrentCard,
  } = useReviewStore(
    useShallow(s => ({
      status: s.status, cards: s.cards, currentIndex: s.currentIndex,
      isRevealed: s.isRevealed, totalCount: s.totalCount,
      stats: s.stats, error: s.error,
      loadDueCards: s.loadDueCards, reveal: s.reveal,
      rate: s.rate, refreshCurrentCard: s.refreshCurrentCard,
    })),
  );

  useEffect(() => {
    loadDueCards(songId);
  }, [songId]);

  useFocusEffect(
    useCallback(() => {
      if (status === 'reviewing') {
        refreshCurrentCard();
      }
    }, [status, refreshCurrentCard]),
  );

  const handleBack = () => {
    if (status === 'summary') {
      finishReview();
      return;
    }
    navigation.goBack();
  };

  const finishReview = () => {
    if (songId != null) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  };

  // Android hardware back button on summary: return to the screen that opened Review
  useFocusEffect(
    useCallback(() => {
      if (status !== 'summary') return;
      const onBackPress = () => {
        finishReview();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [status, songId])
  );

  const openDictionary = (word: string) => {
    Linking.openURL(`https://ja.dict.naver.com/#/search?query=${encodeURIComponent(word)}`);
  };

  const loadById = usePlayerStore(s => s.loadById);

  const handleSongPress = useCallback(async (songId: number, lyricLine: string | null) => {
    await loadById(songId);
    const playerState = usePlayerStore.getState();
    if (playerState.status === 'success') {
      let initialSeekMs: number | undefined;
      let initialLyricIndex: number | undefined;
      if (lyricLine && playerState.studyData) {
        const idx = playerState.studyData.studyUnits.findIndex(
          u => u.originalText === lyricLine,
        );
        if (idx >= 0) {
          initialLyricIndex = idx;
          const match = playerState.studyData.studyUnits[idx];
          if (match.startTimeMs != null) {
            initialSeekMs = match.startTimeMs;
          }
        }
      }
      navigation.navigate('Player', { origin: 'Review', initialSeekMs, initialLyricIndex });
    }
  }, [loadById, navigation]);

  const handleEditWord = () => {
    const card = cards[currentIndex];
    if (!card) return;
    navigation.navigate('EditWord', {
      mode: 'edit',
      wordId: card.wordId,
      japanese: card.japanese,
      reading: card.reading ?? undefined,
      meanings: card.meanings,
    });
  };

  const renderTopNav = (dictWord?: string, showEdit?: boolean) => {
    return (
      <AppBar
        onBack={handleBack}
        trailing={
          <View style={styles.topNavRight}>
            {showEdit && (
              <TouchableOpacity onPress={handleEditWord} hitSlop={8}>
                <Feather name="edit-2" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
            {dictWord && (
              <TouchableOpacity onPress={() => openDictionary(dictWord)} hitSlop={8}>
                <Feather name="external-link" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        }
      />
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
            {renderTopNav(isRevealed ? card.japanese : undefined, isRevealed)}

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
                    <FlashcardBackDetails card={card} onSongPress={handleSongPress} />
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
            {!isRevealed ? (
              <Pressable style={styles.actionRow} onPress={reveal}>
                <Text style={styles.hintText}>탭하여 뒷면 보기</Text>
              </Pressable>
            ) : (
              <View style={styles.actionRow}>
                <RatingButtonRow intervals={card.intervals} onRate={rate} />
              </View>
            )}
          </>
        );
      }

      case 'summary':
        return (
          <>
            {renderTopNav()}
            <SummaryView
              onFinish={finishReview}
              ctaLabel='확인'
            />
          </>
        );
    }
  };

  return <SafeAreaView style={styles.container}>{renderContent()}</SafeAreaView>;
}

function SummaryView({ onFinish, ctaLabel }: { onFinish: () => void; ctaLabel: string }) {
  const circleScale = useSharedValue(0);
  const circleOpacity = useSharedValue(0);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0.35);
  const checkOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0.6);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(8);
  const subOpacity = useSharedValue(0);
  const subY = useSharedValue(8);
  const btnOpacity = useSharedValue(0);
  const btnY = useSharedValue(8);

  useEffect(() => {
    circleScale.value = withSequence(
      withTiming(1.15, { duration: 320, easing: Easing.out(Easing.back(1.7)) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.cubic) }),
    );
    circleOpacity.value = withTiming(1, { duration: 320 });

    rippleScale.value = withTiming(1.7, { duration: 1000, easing: Easing.out(Easing.cubic) });
    rippleOpacity.value = withTiming(0, { duration: 1000, easing: Easing.out(Easing.cubic) });

    checkOpacity.value = withDelay(520, withTiming(1, { duration: 320 }));
    checkScale.value = withDelay(
      520,
      withTiming(1, { duration: 360, easing: Easing.out(Easing.back(1.5)) }),
    );

    titleOpacity.value = withDelay(760, withTiming(1, { duration: 340 }));
    titleY.value = withDelay(760, withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) }));

    subOpacity.value = withDelay(900, withTiming(1, { duration: 340 }));
    subY.value = withDelay(900, withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) }));

    btnOpacity.value = withDelay(1040, withTiming(1, { duration: 340 }));
    btnY.value = withDelay(1040, withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) }));
  }, []);

  const circleStyle = useAnimatedStyle(() => ({
    opacity: circleOpacity.value,
    transform: [{ scale: circleScale.value }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value,
    transform: [{ scale: rippleScale.value }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const subStyle = useAnimatedStyle(() => ({
    opacity: subOpacity.value,
    transform: [{ translateY: subY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: btnY.value }],
  }));

  return (
    <>
      <View style={styles.center}>
        <View style={styles.celebrationGroup}>
          <View style={styles.checkCircleWrap}>
            <Animated.View style={[styles.ripple, rippleStyle]} pointerEvents="none" />
            <Animated.View style={[styles.checkCircle, circleStyle]}>
              <Animated.View style={checkStyle}>
                <Feather name="check" size={40} color={Colors.primary} />
              </Animated.View>
            </Animated.View>
          </View>
          <Animated.Text style={[styles.completeTitle, titleStyle]}>학습 완료!</Animated.Text>
          <Animated.Text style={[styles.completeSubtitle, subStyle]}>
            복습을 모두 마쳤어요.
          </Animated.Text>
        </View>
      </View>

      <Animated.View style={[styles.bottomBtnArea, btnStyle]}>
        <PrimaryButton label={ctaLabel} onPress={onFinish} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  topNavRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
    paddingRight: 8,
  },
  dictButton: {
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
  checkCircleWrap: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '20',
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
  // Bottom button
  bottomBtnArea: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
});
