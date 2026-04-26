import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Colors } from '../theme/theme';

interface Props {
  artworkUrl: string | null | undefined;
  title: string;
  artist: string;
  onPress: () => void;
}

export default function SongCard({ artworkUrl, title, artist, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {artworkUrl ? (
        <Image source={{ uri: artworkUrl }} style={styles.coverImage} />
      ) : (
        <View style={[styles.coverImage, { backgroundColor: Colors.elevated }]} />
      )}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.artist} numberOfLines={1}>{artist}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  title: {
    position: 'absolute',
    left: 8,
    bottom: 21,
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: '#000000CC',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  artist: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    fontSize: 9,
    fontWeight: '400',
    color: '#FFFFFFCC',
    textShadowColor: '#000000CC',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
