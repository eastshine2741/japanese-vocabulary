import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ArtworkImage from '../ArtworkImage';
import WordMasteryProgressBar from '../WordMasteryProgressBar';
import { Colors } from '../../theme/theme';
import { SongProgressItem } from './songProgress';

interface Props {
  item: SongProgressItem;
  onPress: (item: SongProgressItem) => void;
}

function SongProgressRow({ item, onPress }: Props) {
  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  return (
    <TouchableOpacity style={styles.row} onPress={handlePress} activeOpacity={0.72}>
      <ArtworkImage url={item.artworkUrl} size={48} cornerRadius={10} style={styles.artwork} />
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.count}>{item.totalWords}단어</Text>
        </View>
        <WordMasteryProgressBar
          totalCount={item.totalWords}
          masteredCount={item.masteredCount}
          studyingCount={item.learningCount}
        />
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

export default React.memo(SongProgressRow);

const styles = StyleSheet.create({
  row: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  artwork: {
    backgroundColor: '#DDE7DD',
  },
  body: {
    flex: 1,
    gap: 9,
  },
  top: {
    minHeight: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  count: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
