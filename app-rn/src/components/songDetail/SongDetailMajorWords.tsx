import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { selectMajorWords } from './songDetailWordDerivation';
import { getSongDetailWordKey } from './songDetailWordSave';
import { SongDetailWordItem } from './types';

interface MajorWordCardProps {
  word: SongDetailWordItem;
  isBusy: boolean;
  onStartWordLearning: (word: SongDetailWordItem) => void;
}

interface SongDetailMajorWordsProps {
  words: readonly SongDetailWordItem[];
  isLoading?: boolean;
  onViewAllWordsPress?: () => void;
  busyWordKey?: string | null;
  onStartWordLearning: (word: SongDetailWordItem) => void;
}

const MajorWordCard = React.memo(function MajorWordCard({
  word,
  isBusy,
  onStartWordLearning,
}: MajorWordCardProps) {
  const handlePress = useCallback(() => {
    onStartWordLearning(word);
  }, [onStartWordLearning, word]);
  const label = word.baseForm || word.japanese || word.surface;
  const reading = word.reading;

  return (
    <TouchableOpacity
      style={[styles.wordCard, isBusy && styles.wordCardBusy]}
      onPress={handlePress}
      activeOpacity={0.78}
      disabled={isBusy}
      accessibilityRole="button"
      accessibilityLabel={`${label} 단어로 학습 시작`}
    >
      <View style={styles.cardBadgeRow}>
        {word.jlpt ? (
          <View style={styles.jlptBadge}>
            <Text style={styles.jlptText}>{word.jlpt}</Text>
          </View>
        ) : <View />}
      </View>
      <View style={styles.wordTextBlock}>
        {reading ? <Text style={styles.reading} numberOfLines={1}>{reading}</Text> : null}
        <Text style={styles.japanese} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
          {label}
        </Text>
      </View>
      <View style={styles.maskButton}>
        {isBusy ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <>
            <Feather name="eye-off" size={12} color={Colors.textMuted} />
            <Text style={styles.maskLabel}>뜻 확인하기</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
});

export const SongDetailMajorWords = React.memo(function SongDetailMajorWords({
  words,
  isLoading = false,
  onViewAllWordsPress,
  busyWordKey,
  onStartWordLearning,
}: SongDetailMajorWordsProps) {
  const majorWords = useMemo(() => selectMajorWords(words), [words]);
  const handleViewAll = useCallback(() => {
    onViewAllWordsPress?.();
  }, [onViewAllWordsPress]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>핵심 단어</Text>
        <Text style={styles.description}>뜻을 보기 전에, 아는 단어인지 먼저 떠올려 보세요.</Text>
      </View>

      {isLoading ? (
        <View style={styles.list}>
          <View style={styles.stateBox}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.stateText}>단어를 불러오는 중이에요.</Text>
          </View>
        </View>
      ) : majorWords.length === 0 ? (
        <View style={styles.list}>
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>아직 표시할 단어가 없어요.</Text>
          </View>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardRail}
        >
          {majorWords.map(word => {
            const wordKey = getSongDetailWordKey(word);
            return (
              <MajorWordCard
                key={wordKey}
                word={word}
                isBusy={busyWordKey === wordKey}
                onStartWordLearning={onStartWordLearning}
              />
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.viewAllButton}
        onPress={handleViewAll}
        activeOpacity={0.72}
        disabled={!onViewAllWordsPress}
      >
        <Feather name="list" size={15} color={Colors.textSecondary} />
        <Text style={styles.viewAllText}>모든 단어 보기</Text>
        <Feather name="chevron-right" size={14} color={Colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  header: {
    gap: 3,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  list: {
    overflow: 'hidden',
  },
  cardRail: {
    gap: 10,
    paddingRight: 4,
  },
  wordCard: {
    width: 122,
    minHeight: 138,
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  wordCardBusy: {
    opacity: 0.68,
  },
  cardBadgeRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  jlptBadge: {
    height: 18,
    justifyContent: 'center',
    borderRadius: 9999,
    paddingHorizontal: 7,
    backgroundColor: Colors.primaryBg,
  },
  jlptText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  wordTextBlock: {
    alignItems: 'center',
    gap: 2,
  },
  reading: {
    maxWidth: '100%',
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  japanese: {
    maxWidth: '100%',
    color: Colors.textPrimary,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
  },
  maskButton: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 6,
    backgroundColor: Colors.elevated,
  },
  maskLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  stateBox: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stateText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  viewAllButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewAllText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
