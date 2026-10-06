import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ArtworkImage from '../ArtworkImage';
import { KARAOKE_NUMBERS_WIDTH, KaraokeNumberTag } from './KaraokeNumberTag';
import { Colors, Dimens } from '../../theme/theme';
import { fontStyle } from '../../theme/typography';
import { KaraokeSongItem } from '../../types/karaoke';

const CHEVRON_SIZE = 18;

interface Props {
  item: KaraokeSongItem;
  onPress?: (songId: number) => void;
  /** 디스커버리 카드용 — 작은 아트와 제목. */
  compact?: boolean;
  /** 월별은 아티스트로 묶여 있어 줄에서 뺀다. */
  showArtist?: boolean;
}

export const KaraokeSongRow = React.memo(function KaraokeSongRow({
  item,
  onPress,
  compact = false,
  showArtist = true,
}: Props) {
  // 분석이 끝난 곡만 songId 가 있고, 그 곡만 상세로 들어갈 수 있다.
  const songId = item.songId;
  const navigable = songId != null && onPress != null;

  const handlePress = useCallback(() => {
    if (songId != null) onPress?.(songId);
  }, [onPress, songId]);

  const content = (
    <>
      <ArtworkImage
        url={item.artworkUrl}
        size={compact ? 44 : 48}
        cornerRadius={8}
      />
      <View style={styles.info}>
        <Text style={compact ? styles.titleCompact : styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        {showArtist ? (
          <Text style={styles.artist} numberOfLines={1}>
            {item.artist}
          </Text>
        ) : null}
      </View>
      <View style={[styles.numbers, compact && styles.numbersCompact]}>
        {item.tjNumber != null ? <KaraokeNumberTag brand="TJ" number={item.tjNumber} /> : null}
        {item.kyNumber != null ? <KaraokeNumberTag brand="KY" number={item.kyNumber} /> : null}
      </View>
      <View style={[styles.chevronSlot, !navigable && styles.chevronDisabled]}>
        <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={Colors.textMuted} />
      </View>
    </>
  );

  if (!navigable) {
    return <View style={[styles.row, compact && styles.rowCompact]}>{content}</View>;
  }

  return (
    <TouchableOpacity
      style={[styles.row, compact && styles.rowCompact]}
      onPress={handlePress}
      activeOpacity={0.72}
    >
      {content}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Dimens.screenPadding,
  },
  rowCompact: {
    height: 64,
    gap: 10,
  },
  info: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textPrimary,
    ...fontStyle('body', '500'),
  },
  titleCompact: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
    ...fontStyle('body', '500'),
  },
  artist: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  numbers: {
    width: KARAOKE_NUMBERS_WIDTH,
    gap: 4,
    alignItems: 'flex-end',
  },
  numbersCompact: {
    gap: 3,
  },
  chevronSlot: {
    width: CHEVRON_SIZE,
    alignItems: 'center',
  },
  chevronDisabled: {
    opacity: 0.4,
  },
});
