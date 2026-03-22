import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { Token } from '../types/song';
import { WordDetailResponse } from '../types/word';
import { POS_INFO } from '../types/pos';
import { Colors } from '../theme/theme';
import ArtworkImage from './ArtworkImage';

interface Props {
  token: Token;
  addStatus: string;
  getWordStatus: string;
  existingWord: WordDetailResponse | null;
  songId: number;
  lyricLine: string;
  onAddWord: () => void;
}

export default function WordAnalysisSheet({
  token,
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

  const isMeaningNew = token.koreanText != null &&
    !(existingWord?.meanings.some(m => m.text === token.koreanText) ?? false);

  const posInfo = POS_INFO[token.partOfSpeech];

  const handleExScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / examplePageWidth);
    setActiveExIndex(idx);
  }, [examplePageWidth]);

  const isGetWordLoading = getWordStatus === 'loading' || getWordStatus === 'idle';

  const renderButton = () => {
    if (isGetWordLoading || addStatus === 'loading') {
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
    if (token.koreanText == null) {
      return (
        <View style={[styles.saveBtn, styles.saveBtnDisabled]}>
          <Text style={styles.saveBtnTextDisabled}>단어 담기</Text>
        </View>
      );
    }
    if (isExisting && !isMeaningNew) {
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
    if (isExisting && isMeaningNew) {
      return (
        <TouchableOpacity
          style={[styles.saveBtn, styles.saveBtnPrimary]}
          onPress={onAddWord}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.saveBtnText}>다른 뜻 담기</Text>
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

        <View style={styles.badgeRow}>
          {posInfo && (
            <View style={[styles.badge, { backgroundColor: posInfo.color + '20' }]}>
              <Text style={[styles.posText, { color: posInfo.color }]}>{posInfo.korean}</Text>
            </View>
          )}
        </View>

        {token.koreanText ? (
          <Text style={styles.meaning}>{token.koreanText}</Text>
        ) : (
          <Text style={styles.meaningEmpty}>뜻 정보가 없습니다</Text>
        )}

        {isExisting && existingWord && existingWord.meanings.length > 0 && (
          <Text style={styles.existingMeanings}>
            저장된 뜻: {existingWord.meanings.map(m => m.text).join(', ')}
          </Text>
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

      {/* Action button */}
      <View style={styles.actionArea}>
        {renderButton()}
      </View>
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
    flexWrap: 'wrap',
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
  meaning: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  meaningEmpty: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  existingMeanings: {
    fontSize: 13,
    color: Colors.textSecondary,
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
});
