import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ArtworkImage from './ArtworkImage';
import { Colors } from '../theme/theme';

export interface MiniStats {
  learning: number;
  review: number;
  relearning: number;
  retrievability: number | null;
}

interface Props {
  artworkUrl: string | null | undefined;
  title: string;
  subtitle: string;
  trailing?: string;
  isHighlighted?: boolean;
  miniStats?: MiniStats;
  showChevron?: boolean;
  onPress: () => void;
}

export default function SongListItem({
  artworkUrl,
  title,
  subtitle,
  trailing,
  isHighlighted = false,
  miniStats,
  showChevron = false,
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      style={[styles.container, isHighlighted && styles.highlighted]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <ArtworkImage url={artworkUrl} size={48} cornerRadius={8} />
      <View style={styles.content}>
        <Text
          style={[styles.title, isHighlighted && styles.highlightedTitle]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        {miniStats && (
          <View style={styles.miniStatsRow}>
            <Text style={[styles.miniStatText, { color: Colors.stateLearning }]}>
              학습 {miniStats.learning}
            </Text>
            <Text style={[styles.miniStatText, { color: Colors.stateReview }]}>
              {'  '}복습 {miniStats.review}
            </Text>
            <Text style={[styles.miniStatText, { color: Colors.stateRelearning }]}>
              {'  '}재학습 {miniStats.relearning}
            </Text>
            {miniStats.retrievability != null && (
              <Text style={[styles.miniStatText, { color: Colors.stateRetrievability }]}>
                {'  '}R {Math.round(miniStats.retrievability * 100)}%
              </Text>
            )}
          </View>
        )}
      </View>
      {trailing && !showChevron && <Text style={styles.trailing}>{trailing}</Text>}
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  highlighted: {
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
  },
  content: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  highlightedTitle: { fontWeight: '700', color: Colors.primary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  trailing: { fontSize: 13, color: Colors.textSecondary },
  miniStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  miniStatText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
