import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { useDeckDetailStore } from '../stores/deckDetailStore';
import { usePlayerStore } from '../stores/playerStore';
import ArtworkImage from '../components/ArtworkImage';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';
import { AppBar } from '../components/AppBar';
import { Colors, Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckDetail'>;

function AllWordsArtwork() {
  return (
    <View style={styles.allWordsArtwork}>
      <View style={styles.allWordsGlow} />
      <View style={styles.allWordsAccentDot} />
      <View style={styles.allWordsBackCard}>
        <Ionicons name="layers-outline" size={24} color={Colors.textMuted} />
      </View>
      <View style={styles.allWordsFrontCard}>
        <Ionicons name="layers-outline" size={28} color="#FFFFFF" />
        <Text style={styles.allWordsFrontLabel}>ALL WORDS</Text>
      </View>
    </View>
  );
}

export default function DeckDetailScreen({ route, navigation }: Props) {
  const { deckId } = route.params;
  const { status, data, error, load } = useDeckDetailStore(
    useShallow(s => ({ status: s.status, data: s.data, error: s.error, load: s.load })),
  );
  const loadById = usePlayerStore(s => s.loadById);
  const playerStatus = usePlayerStore(s => s.status);
  const isAllDeck = deckId == null;

  useFocusEffect(
    useCallback(() => {
      load(deckId);
    }, [deckId]),
  );

  const songId = data?.songId ?? null;

  const handleListenSong = useCallback(async () => {
    if (songId == null) return;
    await loadById(songId);
    if (usePlayerStore.getState().status === 'success') {
      navigation.navigate('Player', { origin: 'DeckDetail' });
    }
  }, [songId, loadById, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <AppBar onBack={() => navigation.goBack()} />

        {status === 'loading' && (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.center} />
        )}
        {status === 'error' && <Text style={styles.errorText}>{error}</Text>}
        {status === 'success' && data && (
          <View style={styles.content}>
            {/* Artwork */}
            {isAllDeck ? (
              <AllWordsArtwork />
            ) : (
              <ArtworkImage url={data.artworkUrl} size={200} cornerRadius={16} />
            )}

            {isAllDeck ? (
              <View style={styles.allDeckInfo}>
                <Text style={styles.allDeckTitle}>전체 단어장</Text>
                <Text style={styles.allDeckDescription}>
                  모든 단어를 한 곳에서 빠르게 복습해요.
                </Text>
              </View>
            ) : (
              <>
                {/* Song title */}
                {data.title && <Text style={styles.title}>{data.title}</Text>}

                {/* Artist */}
                {data.artist && <Text style={styles.artist}>{data.artist}</Text>}
              </>
            )}

            {/* Hero: due count */}
            <View style={styles.heroSection}>
              <Text style={styles.heroLabel}>복습할 단어</Text>
              <Text style={styles.heroValue}>{data.dueCount}</Text>
            </View>

            {/* Pipeline bar */}
            {data.wordCount > 0 && (() => {
              const total = data.wordCount;
              const masteredPct = (data.masteredCount / total) * 100;
              const studyingPct = (data.studyingCount / total) * 100;
              const newPct = (data.newWordCount / total) * 100;

              return (
                <View style={styles.pipelineSection}>
                  <View style={styles.segBar}>
                    {masteredPct > 0 && <View style={[styles.segment, { width: `${masteredPct}%`, backgroundColor: Colors.stateReview }]} />}
                    {studyingPct > 0 && <View style={[styles.segment, { width: `${studyingPct}%`, backgroundColor: Colors.stateRetrievability }]} />}
                    {newPct > 0 && <View style={[styles.segment, { width: `${newPct}%`, backgroundColor: Colors.stateRelearning }]} />}
                  </View>
                  <View style={styles.legend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: Colors.stateReview }]} />
                      <Text style={styles.legendText}>외운 단어 {data.masteredCount}</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: Colors.stateRetrievability }]} />
                      <Text style={styles.legendText}>외우는 중 {data.studyingCount}</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: Colors.stateRelearning }]} />
                      <Text style={styles.legendText}>새 단어 {data.newWordCount}</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* Study button */}
            <PrimaryButton
              icon="layers-outline"
              label="학습하기"
              onPress={() => navigation.navigate('Review', { deckId })}
              disabled={data.dueCount === 0}
              style={styles.primaryBtn}
            />

            {/* View words button */}
            <SecondaryButton
              icon="list-outline"
              label="단어 보기"
              onPress={() => navigation.navigate('DeckWordList', { deckId })}
              style={styles.secondaryBtn}
            />

            {/* Listen song button — only for per-song decks */}
            {songId !== null && (
              <SecondaryButton
                icon="play-circle-outline"
                label="노래 듣기"
                onPress={handleListenSong}
                style={styles.secondaryBtn}
              />
            )}
          </View>
        )}
        {playerStatus === 'loading' && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  errorText: {
    color: Colors.ratingAgain,
    textAlign: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Dimens.screenPadding,
    gap: 32,
  },
  allWordsArtwork: {
    width: 200,
    height: 200,
    borderRadius: 28,
    backgroundColor: '#F4EFE7',
    overflow: 'hidden',
  },
  allWordsGlow: {
    position: 'absolute',
    top: 22,
    right: 22,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCEEDD',
  },
  allWordsAccentDot: {
    position: 'absolute',
    left: 21,
    top: 119,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3D4B8',
  },
  allWordsBackCard: {
    position: 'absolute',
    left: 35,
    top: 47,
    width: 104,
    height: 126,
    borderRadius: 24,
    backgroundColor: '#E6DED3',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-6deg' }],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  allWordsFrontCard: {
    position: 'absolute',
    left: 53,
    top: 29,
    width: 112,
    height: 136,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    transform: [{ rotate: '6deg' }],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  allWordsFrontLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#FFFFFF',
  },
  allDeckInfo: {
    alignItems: 'center',
    gap: 8,
    marginTop: -16,
    width: '100%',
  },
  allDeckTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -1,
  },
  allDeckDescription: {
    maxWidth: 260,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: -16,
  },
  artist: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: -24,
  },
  heroSection: {
    alignItems: 'center',
    gap: 4,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  pipelineSection: {
    width: '100%',
    gap: 6,
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
  primaryBtn: {
    width: '100%',
  },
  secondaryBtn: {
    width: '100%',
    marginTop: -16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
