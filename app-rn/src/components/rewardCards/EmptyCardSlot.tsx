import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { ARTIST_CARD_RATIO, CARD_RATIO } from './cardTheme';

const SONG_SLOT_COUNT = 3;

/** 아티스트 카드가 놓일 빈 자리. 카드와 같은 크기라 섹션 높이가 카드가 생겨도 그대로다. */
export const ArtistCardSlot = React.memo(function ArtistCardSlot({ width }: { width: number }) {
  return (
    <View style={[styles.slot, styles.artistSlot, { width, height: width * ARTIST_CARD_RATIO, borderRadius: width * 0.04 }]}>
      <View style={styles.iconCircle}>
        <Ionicons name="person-outline" size={20} color={Colors.textMuted} />
      </View>
      <Text style={styles.artistCopy}>{'좋아하는 아티스트의 노래를 공부하면\n카드를 받을 수 있어요'}</Text>
    </View>
  );
});

/** 곡 카드 그리드 한 줄 자리의 빈 카드들. */
export const SongCardSlots = React.memo(function SongCardSlots({ width, gap }: { width: number; gap: number }) {
  const slot = { width, height: width * CARD_RATIO, borderRadius: width * 0.046 };
  return (
    <View style={styles.songRoot}>
      <View style={[styles.songRow, { gap }]}>
        {Array.from({ length: SONG_SLOT_COUNT }, (_, i) => (
          <View key={i} style={[styles.slot, slot]}>
            <Ionicons name="musical-notes-outline" size={22} color={Colors.border} />
          </View>
        ))}
      </View>
      <Text style={styles.songCopy}>좋아하는 노래를 공부하면 카드를 받을 수 있어요</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  artistSlot: { gap: 10, paddingHorizontal: 16 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.elevated,
  },
  artistCopy: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: Colors.textSecondary, textAlign: 'center' },
  songRoot: { gap: 12 },
  songRow: { flexDirection: 'row' },
  songCopy: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: Colors.textSecondary, textAlign: 'center' },
});
