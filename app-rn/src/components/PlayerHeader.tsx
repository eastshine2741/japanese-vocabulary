import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

interface Props {
  title: string;
  artist: string;
  onOpenVocab: () => void;
  onOpenInfo: () => void;
  vocabEnabled: boolean;
}

function PlayerHeader({ title, artist, onOpenVocab, onOpenInfo, vocabEnabled }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.songInfo}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{artist}</Text>
      </View>
      <TouchableOpacity
        style={styles.infoBtn}
        onPress={onOpenInfo}
        activeOpacity={0.7}
        hitSlop={8}
        accessibilityLabel="곡 정보"
      >
        <Feather name="info" size={18} color={Colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.chip, !vocabEnabled && styles.chipDisabled]}
        onPress={onOpenVocab}
        activeOpacity={0.7}
        disabled={!vocabEnabled}
        accessibilityState={{ disabled: !vocabEnabled }}
      >
        <Feather
          name="book-open"
          size={14}
          color={vocabEnabled ? Colors.textPrimary : Colors.textMuted}
        />
        <Text style={[styles.chipText, !vocabEnabled && styles.chipTextDisabled]}>단어장</Text>
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(PlayerHeader);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 24,
    gap: 12,
    backgroundColor: Colors.background,
  },
  songInfo: {
    flex: 1,
    gap: 4,
  },
  infoBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  artist: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: Colors.card,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  chipTextDisabled: {
    color: Colors.textMuted,
  },
});
