import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Token } from '../types/song';
import { WordDefinitionDTO, WordDetailResponse } from '../types/word';
import { Colors } from '../theme/theme';
import ArtworkImage from './ArtworkImage';

interface Props {
  token: Token;
  lookupStatus: string;
  definition: WordDefinitionDTO | null;
  lookupError: string | null;
  addStatus: string;
  getWordStatus: string;
  existingWord: WordDetailResponse | null;
  songId: number;
  lyricLine: string;
  onAddWord: () => void;
}

const POS_COLORS: Record<string, string> = {
  '名詞': Colors.posNoun,
  '動詞': Colors.posVerb,
  '形容詞': Colors.posAdjective,
  '副詞': Colors.posAdverb,
  '助詞': Colors.posParticle,
};

const JLPT_COLORS: Record<string, string> = {
  N1: Colors.jlptN1,
  N2: Colors.jlptN2,
  N3: Colors.jlptN3,
  N4: Colors.jlptN4,
  N5: Colors.jlptN5,
};

export default function WordAnalysisSheet({
  token,
  lookupStatus,
  definition,
  lookupError,
  addStatus,
  getWordStatus,
  existingWord,
  songId,
  lyricLine,
  onAddWord,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const examplePageWidth = screenWidth - 48; // 24px padding each side
  const [activeExIndex, setActiveExIndex] = useState(0);

  const isExisting = getWordStatus === 'found';
  const isFromThisLine = existingWord?.examples.some(
    ex => ex.songId === songId && ex.lyricLine === lyricLine,
  ) ?? false;

  const handleExScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / examplePageWidth);
    setActiveExIndex(idx);
  }, [examplePageWidth]);

  const renderButton = () => {
    if (addStatus === 'loading') {
      return (
        <View style={[styles.saveBtn, styles.saveBtnPrimary]}>
          <ActivityIndicator color="#FFF" size="small" />
        </View>
      );
    }
    if (addStatus === 'success' || (isExisting && isFromThisLine)) {
      return (
        <View style={[styles.saveBtn, styles.saveBtnDisabled]}>
          <Feather name="check" size={18} color="#A1A1AA" />
          <Text style={styles.saveBtnTextDisabled}>이미 담은 단어</Text>
        </View>
      );
    }
    if (isExisting) {
      return (
        <TouchableOpacity
          style={[styles.saveBtn, styles.saveBtnPrimary]}
          onPress={onAddWord}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.saveBtnText}>예문 담기</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={[styles.saveBtn, styles.saveBtnPrimary]}
        onPress={onAddWord}
        activeOpacity={0.7}
      >
        <Feather name="plus" size={18} color="#FFFFFF" />
        <Text style={styles.saveBtnText}>단어 담기</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.hdr}>
        <View style={styles.wordRow}>
          <Text style={styles.wordMain}>{token.surface}</Text>
          {token.reading && (
            <Text style={styles.wordRead}>{token.reading}</Text>
          )}
        </View>

        {lookupStatus === 'success' && definition && (
          <>
            <View style={styles.badgeRow}>
              {definition.partsOfSpeech.map((p, i) => {
                const color = POS_COLORS[p] || '#6366F1';
                return (
                  <View key={`pos-${i}`} style={[styles.badge, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.posText, { color }]}>{p}</Text>
                  </View>
                );
              })}
              {definition.jlptLevel && (() => {
                const color = JLPT_COLORS[definition.jlptLevel] || '#999999';
                return (
                  <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.jlptText, { color }]}>{definition.jlptLevel}</Text>
                  </View>
                );
              })()}
            </View>
            <Text style={styles.meaning}>{definition.meanings.join(', ')}</Text>
          </>
        )}
      </View>

      {/* Example section — only when word already exists */}
      {isExisting && existingWord && existingWord.examples.length > 0 && (
        <View style={styles.exSec}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleExScroll}
            style={{ marginHorizontal: -24 }}
            contentContainerStyle={{ paddingHorizontal: 24 }}
            snapToInterval={examplePageWidth}
            decelerationRate="fast"
          >
            {existingWord.examples.map((ex, i) => (
              <View key={i} style={[styles.exCard, { width: examplePageWidth }]}>
                <ArtworkImage url={null} size={28} cornerRadius={6} />
                <View style={styles.ex1Txt}>
                  {ex.lyricLine && (
                    <Text style={styles.e1jp}>{ex.lyricLine}</Text>
                  )}
                  {ex.songTitle && (
                    <Text style={styles.e1src}>{ex.songTitle}</Text>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
          {existingWord.examples.length > 1 && (
            <View style={styles.dots}>
              {existingWord.examples.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, { backgroundColor: i === activeExIndex ? Colors.textPrimary : Colors.border }]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Loading / Error */}
      {lookupStatus === 'loading' && (
        <ActivityIndicator style={styles.loader} color={Colors.primary} />
      )}
      {lookupStatus === 'error' && (
        <Text style={styles.errorText}>{lookupError || 'Lookup failed'}</Text>
      )}

      {/* Action button */}
      {lookupStatus === 'success' && definition && (
        <View style={styles.actionArea}>
          {renderButton()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},

  // Header
  hdr: {
    gap: 8,
    paddingTop: 0,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  wordMain: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  wordRead: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  posText: {
    fontSize: 11,
    fontWeight: '600',
  },
  jlptText: {
    fontSize: 11,
    fontWeight: '700',
  },
  meaning: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Example section
  exSec: {
    gap: 12,
    paddingTop: 10,
    paddingHorizontal: 24,
    paddingBottom: 6,
    overflow: 'hidden',
  },
  exCard: {
    flexDirection: 'row',
    gap: 10,
  },
  ex1Txt: {
    flex: 1,
    gap: 3,
  },
  e1jp: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  e1src: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Action area
  actionArea: {
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    height: 48,
    gap: 8,
  },
  saveBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  saveBtnDisabled: {
    backgroundColor: '#E4E4E7',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtnTextDisabled: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '600',
  },

  // States
  loader: {
    marginVertical: 20,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginVertical: 12,
    fontSize: 14,
  },
});
