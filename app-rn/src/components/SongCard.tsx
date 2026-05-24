import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme/theme';

interface Props {
  artworkUrl: string | null | undefined;
  title: string;
  artist: string;
  onPress: () => void;
}

export default function SongCard({ artworkUrl, title, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {artworkUrl ? (
        <Image source={{ uri: artworkUrl }} style={styles.coverImage} />
      ) : (
        <View style={[styles.coverImage, { backgroundColor: Colors.elevated }]} />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.94)']}
        style={styles.gradient}
        pointerEvents="none"
      />
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
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
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  title: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 6,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
