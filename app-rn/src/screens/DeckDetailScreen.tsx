import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { useDeckDetailStore } from '../stores/deckDetailStore';
import { usePlayerStore } from '../stores/playerStore';
import ArtworkImage from '../components/ArtworkImage';
import { Colors, Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckDetail'>;

export default function DeckDetailScreen({ route, navigation }: Props) {
  const { songId } = route.params;
  const { status, data, error, load } = useDeckDetailStore(
    useShallow(s => ({ status: s.status, data: s.data, error: s.error, load: s.load })),
  );
  const loadById = usePlayerStore(s => s.loadById);
  const playerStatus = usePlayerStore(s => s.status);

  useFocusEffect(
    useCallback(() => {
      load(songId);
    }, [songId]),
  );

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
        {/* Top bar: back arrow only */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {status === 'loading' && (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.center} />
        )}
        {status === 'error' && <Text style={styles.errorText}>{error}</Text>}
        {status === 'success' && data && (
          <View style={styles.content}>
            {/* Artwork */}
            <ArtworkImage url={data.artworkUrl} size={200} cornerRadius={16} />

            {/* Song title */}
            {data.title && <Text style={styles.title}>{data.title}</Text>}

            {/* Artist */}
            {data.artist && <Text style={styles.artist}>{data.artist}</Text>}

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
            <TouchableOpacity
              style={[styles.primaryButton, data.dueCount === 0 && styles.buttonDisabled]}
              onPress={() => navigation.navigate('Review', { songId })}
              disabled={data.dueCount === 0}
              activeOpacity={0.7}
            >
              <Ionicons name="layers-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>학습하기</Text>
            </TouchableOpacity>

            {/* View words button */}
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={() => navigation.navigate('DeckWordList', { songId })}
              activeOpacity={0.7}
            >
              <Ionicons name="list-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.outlineButtonText}>단어 보기</Text>
            </TouchableOpacity>

            {/* Listen song button — only for per-song decks */}
            {songId !== null && (
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={handleListenSong}
                activeOpacity={0.7}
              >
                <Ionicons name="play-circle-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.outlineButtonText}>노래 듣기</Text>
              </TouchableOpacity>
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
  topBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Dimens.screenPadding,
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
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  outlineButton: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 8,
    marginTop: -16,
  },
  outlineButtonText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
