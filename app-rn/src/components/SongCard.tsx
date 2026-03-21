import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ArtworkImage from './ArtworkImage';
import { Colors, Dimens } from '../theme/theme';

interface Props {
  artworkUrl: string | null | undefined;
  title: string;
  artist: string;
  onPress: () => void;
}

export default function SongCard({ artworkUrl, title, artist, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.imageWrapper}>
        <ArtworkImage url={artworkUrl} size={999} style={styles.image} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {artist}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 4 },
  imageWrapper: { aspectRatio: 1, borderRadius: Dimens.artworkCornerRadius, overflow: 'hidden' },
  image: { width: '100%', height: '100%', borderRadius: Dimens.artworkCornerRadius },
  title: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginTop: 6 },
  artist: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
});
