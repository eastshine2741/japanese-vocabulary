import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import { KaraokeNotifyToggle } from './KaraokeNotifyToggle';
import { KaraokeSongRow } from './KaraokeSongRow';
import { useSettingsStore } from '../../stores/settingsStore';
import { Colors, Dimens } from '../../theme/theme';
import { fontStyle } from '../../theme/typography';
import { KaraokeDailyGroup } from '../../types/karaoke';

const COLLAPSED_SONGS = 3;
const EXPANDED_SONGS = 9;
const EXPAND_CHEVRON_SIZE = 20;

interface Props {
  group: KaraokeDailyGroup;
  onPressMore: () => void;
  onSelectSong: (songId: number) => void;
}

export default React.memo(function KaraokeNewSection({ group, onPressMore, onSelectSong }: Props) {
  const [expanded, setExpanded] = useState(false);
  const songs = useMemo(
    () => group.songs.slice(0, expanded ? EXPANDED_SONGS : COLLAPSED_SONGS),
    [group.songs, expanded],
  );
  const canExpand = group.songs.length > COLLAPSED_SONGS;

  const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

  const { notificationsEnabled, settingsStatus, loadSettings, toggleNotifications } = useSettingsStore(
    useShallow((s) => ({
      notificationsEnabled: s.karaokeNewSongNotifications,
      settingsStatus: s.status,
      loadSettings: s.loadSettings,
      toggleNotifications: s.toggleKaraokeNewSongNotifications,
    })),
  );

  // status 를 의존성에 두면 실패할 때마다 다시 불러 무한히 재시도한다. 마운트 때 한 번만 읽는다.
  useEffect(() => {
    if (useSettingsStore.getState().status !== 'loaded') loadSettings();
  }, [loadSettings]);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.titleGroup} onPress={onPressMore} activeOpacity={0.72}>
          <Text style={styles.sectionLabel}>노래방 신곡</Text>
          <View style={styles.newPill}>
            <Text style={styles.newPillLabel}>NEW</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
        <KaraokeNotifyToggle
          enabled={notificationsEnabled}
          onPress={toggleNotifications}
          disabled={settingsStatus === 'loading'}
        />
      </View>

      <View>
        {songs.map((song) => (
          <KaraokeSongRow
            key={`${song.title}-${song.artist}`}
            item={song}
            onPress={onSelectSong}
            compact
          />
        ))}
        {canExpand ? (
          <TouchableOpacity
            style={styles.expandRow}
            onPress={toggleExpanded}
            activeOpacity={0.72}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={EXPAND_CHEVRON_SIZE}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: 8,
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
});
