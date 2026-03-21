import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ArtworkImage from './ArtworkImage';
import { Colors } from '../theme/theme';

interface Props {
  artworkUrl: string | null | undefined;
  title: string;
  subtitle: string;
  trailing?: string;
  isHighlighted?: boolean;
  onPress: () => void;
}

export default function SongListItem({
  artworkUrl,
  title,
  subtitle,
  trailing,
  isHighlighted = false,
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      style={[styles.container, isHighlighted && styles.highlighted]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <ArtworkImage url={artworkUrl} size={56} />
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
      </View>
      {trailing && <Text style={styles.trailing}>{trailing}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  highlighted: {
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
  },
  content: { flex: 1 },
  title: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  highlightedTitle: { fontWeight: '700', color: Colors.primary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  trailing: { fontSize: 13, color: Colors.textSecondary },
});
