import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ArtworkImage from '../ArtworkImage';
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

  const segments = useMemo(() => {
    const total = Math.max(1, item.totalWords);
    return {
      mastered: Math.round((item.masteredCount / total) * 260),
      learning: Math.round((item.learningCount / total) * 260),
    };
  }, [item.learningCount, item.masteredCount, item.totalWords]);

  return (
    <TouchableOpacity style={styles.row} onPress={handlePress} activeOpacity={0.72}>
      <ArtworkImage url={item.artworkUrl} size={48} cornerRadius={10} style={styles.artwork} />
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.count}>{item.totalWords}단어</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.knownSegment, { width: segments.mastered }]} />
          <View style={[styles.learningSegment, { width: segments.learning, left: segments.mastered + 2 }]} />
        </View>
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
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#F6F6F6',
    overflow: 'hidden',
  },
  knownSegment: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.primary,
  },
  learningSegment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: Colors.accentSecondary,
  },
});
