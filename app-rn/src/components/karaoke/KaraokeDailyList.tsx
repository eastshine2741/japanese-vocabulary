import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, SectionList, SectionListData, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { KaraokeSectionHeader } from './KaraokeSectionHeader';
import { KaraokeSongRow } from './KaraokeSongRow';
import { useKaraokeStore } from '../../stores/karaokeStore';
import { Colors } from '../../theme/theme';
import { KaraokeSongItem } from '../../types/karaoke';
import { formatMonthDay, formatWeekday } from '../../utils/yearMonth';

interface DaySection {
  listedOn: string;
  data: KaraokeSongItem[];
}

interface Props {
  onSelectSong: (songId: number) => void;
  paddingBottom: number;
}

export default function KaraokeDailyList({ onSelectSong, paddingBottom }: Props) {
  const { status, groups, loadingMore, error, loadOlderDaily } = useKaraokeStore(
    useShallow((s) => ({
      status: s.daily.status,
      groups: s.daily.groups,
      loadingMore: s.daily.loadingMore,
      error: s.daily.error,
      loadOlderDaily: s.loadOlderDaily,
    })),
  );

  const sections = useMemo<DaySection[]>(
    () => groups.map((g) => ({ listedOn: g.listedOn, data: g.songs })),
    [groups],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<KaraokeSongItem, DaySection> }) => (
      <KaraokeSectionHeader
        main={formatMonthDay(section.listedOn)}
        sub={formatWeekday(section.listedOn)}
        count={section.data.length}
      />
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: KaraokeSongItem }) => <KaraokeSongRow item={item} onPress={onSelectSong} />,
    [onSelectSong],
  );

  if (status === 'loading' && groups.length === 0) {
    return <ActivityIndicator color={Colors.primary} style={styles.center} />;
  }

  if (status === 'error' && groups.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{error}</Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      stickySectionHeadersEnabled={false}
      onEndReached={loadOlderDaily}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<EmptyState />}
      ListFooterComponent={
        loadingMore ? <ActivityIndicator color={Colors.primary} style={styles.footer} /> : null
      }
      contentContainerStyle={{ paddingBottom }}
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={7}
    />
  );
}

const keyExtractor = (item: KaraokeSongItem, index: number) =>
  `${item.title}-${item.artist}-${index}`;

const EmptyState = React.memo(function EmptyState() {
  return (
    <View style={styles.center}>
      <Text style={styles.message}>아직 올라온 신곡이 없어요</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  center: {
    flex: 1,
    paddingTop: 80,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  message: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  footer: {
    paddingVertical: 20,
  },
});
