import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { KaraokeSongRow } from './KaraokeSongRow';
import { Colors, Dimens } from '../../theme/theme';
import { fontStyle } from '../../theme/typography';
import { KaraokeDailyGroup } from '../../types/karaoke';
import { formatMonthDay } from '../../utils/yearMonth';

const COLLAPSED_SONGS = 3;
const EXPANDED_SONGS = 9;
const EXPAND_CHEVRON_SIZE = 20;
const EXPAND_DURATION = 280;

interface Props {
  group: KaraokeDailyGroup;
  onPressMore: () => void;
  onSelectSong: (songId: number) => void;
}

export default React.memo(function KaraokeNewSection({ group, onPressMore, onSelectSong }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visibleSongs = useMemo(() => group.songs.slice(0, COLLAPSED_SONGS), [group.songs]);
  const extraSongs = useMemo(
    () => group.songs.slice(COLLAPSED_SONGS, EXPANDED_SONGS),
    [group.songs],
  );
  const canExpand = extraSongs.length > 0;

  const progress = useSharedValue(0);
  const extraHeight = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: EXPAND_DURATION,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [expanded, progress]);

  const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);
  const onExtraLayout = useCallback(
    (e: LayoutChangeEvent) => {
      extraHeight.value = e.nativeEvent.layout.height;
    },
    [extraHeight],
  );

  const extraClipStyle = useAnimatedStyle(() => ({
    height: extraHeight.value * progress.value,
    opacity: progress.value,
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

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
        {visibleSongs.map((song) => (
          <KaraokeSongRow
            key={`${song.title}-${song.artist}`}
            item={song}
            onPress={onSelectSong}
            compact
          />
        ))}
        {canExpand ? (
          <>
            {/* 높이 0 인 부모 안에선 자식도 0 으로 재지므로, absolute 로 띄워 펼친 높이를 잰다. */}
            <Animated.View
              style={[styles.extraClip, extraClipStyle]}
              pointerEvents={expanded ? 'auto' : 'none'}
            >
              <View style={styles.extraContent} onLayout={onExtraLayout}>
                {extraSongs.map((song) => (
                  <KaraokeSongRow
                    key={`${song.title}-${song.artist}`}
                    item={song}
                    onPress={onSelectSong}
                    compact
                  />
                ))}
              </View>
            </Animated.View>
            <TouchableOpacity
              style={styles.expandRow}
              onPress={toggleExpanded}
              activeOpacity={0.72}
            >
              <Animated.View style={chevronStyle}>
                <Ionicons name="chevron-down" size={EXPAND_CHEVRON_SIZE} color={Colors.textMuted} />
              </Animated.View>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  extraClip: {
    overflow: 'hidden',
  },
  extraContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  expandRow: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
