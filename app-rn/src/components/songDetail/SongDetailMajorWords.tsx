import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import SongDetailWordRow from './SongDetailWordRow';
import { selectMajorWords } from './songDetailWordDerivation';
import { SongDetailWordItem } from './types';

interface MajorWordRowProps {
  word: SongDetailWordItem;
  isLast: boolean;
}

interface SongDetailMajorWordsProps {
  words: readonly SongDetailWordItem[];
  isLoading?: boolean;
  onViewAllWordsPress?: () => void;
}

const MajorWordRow = React.memo(function MajorWordRow({ word, isLast }: MajorWordRowProps) {
  return (
    <SongDetailWordRow
      word={word}
      isSaved={word.isSavedForSong || word.savedWordId != null}
      showDivider={!isLast}
    />
  );
});

export const SongDetailMajorWords = React.memo(function SongDetailMajorWords({
  words,
  isLoading = false,
  onViewAllWordsPress,
}: SongDetailMajorWordsProps) {
  const majorWords = useMemo(() => selectMajorWords(words), [words]);
  const handleViewAll = useCallback(() => {
    onViewAllWordsPress?.();
  }, [onViewAllWordsPress]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>주요 단어</Text>
        <Text style={styles.description}>가사 이해에 핵심이 되는 단어를 추렸어요.</Text>
      </View>

      <View style={styles.list}>
        {isLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.stateText}>단어를 불러오는 중이에요.</Text>
          </View>
        ) : majorWords.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>아직 표시할 단어가 없어요.</Text>
          </View>
        ) : (
          majorWords.map((word, index) => (
            <MajorWordRow
              key={`${word.japanese}-${word.appearanceOrder}-${index}`}
              word={word}
              isLast={index === majorWords.length - 1}
            />
          ))
        )}
      </View>

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
