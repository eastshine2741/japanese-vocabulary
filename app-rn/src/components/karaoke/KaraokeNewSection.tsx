import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KaraokeSongRow } from './KaraokeSongRow';
import { Colors, Dimens } from '../../theme/theme';
import { fontStyle } from '../../theme/typography';
import { KaraokeDailyGroup } from '../../types/karaoke';
import { formatMonthDay } from '../../utils/yearMonth';

const MAX_PREVIEW_SONGS = 3;

interface Props {
  group: KaraokeDailyGroup;
  onPressMore: () => void;
  onSelectSong: (songId: number) => void;
}

export default React.memo(function KaraokeNewSection({ group, onPressMore, onSelectSong }: Props) {
  const songs = useMemo(() => group.songs.slice(0, MAX_PREVIEW_SONGS), [group.songs]);

  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.headerRow} onPress={onPressMore} activeOpacity={0.72}>
        <View style={styles.titleGroup}>
          <Text style={styles.sectionLabel}>노래방 신곡</Text>
          <View style={styles.newPill}>
            <Text style={styles.newPillLabel}>NEW</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </View>
        <Text style={styles.updatedAt}>{formatMonthDay(group.listedOn)} 업데이트</Text>
      </TouchableOpacity>

      <View>
        {songs.map((song) => (
          <KaraokeSongRow
            key={`${song.title}-${song.artist}`}
            item={song}
            onPress={onSelectSong}
            compact
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Dimens.screenPadding,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textPrimary,
    ...fontStyle('body', '600'),
  },
  newPill: {
    height: 16,
    paddingHorizontal: 5,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  newPillLabel: {
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.3,
    color: '#FFFFFF',
    ...fontStyle('body', '700'),
  },
  updatedAt: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
  },
});
