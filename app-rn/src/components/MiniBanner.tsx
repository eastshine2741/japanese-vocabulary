import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/theme';

interface Props {
  title: string;
  artist: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
  thumbnail?: React.ReactNode;
}

function MiniBanner({ title, artist, isPlaying, onTogglePlay, thumbnail }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.thumb}>{thumbnail}</View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{artist}</Text>
      </View>
      <TouchableOpacity onPress={onTogglePlay} activeOpacity={0.6} hitSlop={12} style={styles.playBtn}>
        {isPlaying ? (
          <View style={styles.pauseRow}>
            <View style={styles.pauseBar} />
            <View style={styles.pauseBar} />
          </View>
        ) : (
          <View style={styles.triangle} />
        )}
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(MiniBanner);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  thumb: {
    width: 70,
    height: 35,
    borderRadius: 4,
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  artist: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  playBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Solid triangle via border trick (no SVG dep)
  triangle: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 14,
    borderTopColor: 'transparent',
    borderBottomWidth: 14,
    borderBottomColor: 'transparent',
    borderLeftWidth: 22,
    borderLeftColor: Colors.primary,
    marginLeft: 4,
  },
  pauseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pauseBar: {
    width: 5,
    height: 22,
    borderRadius: 1,
    backgroundColor: Colors.primary,
  },
});
