import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  SectionList,
  SectionListData,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import { KaraokeSectionHeader } from './KaraokeSectionHeader';
import { KaraokeSongRow } from './KaraokeSongRow';
import { useKaraokeStore } from '../../stores/karaokeStore';
import { Colors, Dimens } from '../../theme/theme';
import { fontStyle } from '../../theme/typography';
import { KaraokeSongItem } from '../../types/karaoke';
import { currentYearMonth, formatYearMonth } from '../../utils/yearMonth';

interface ArtistSection {
  artist: string;
  data: KaraokeSongItem[];
}

interface Props {
  onSelectSong: (songId: number) => void;
  paddingBottom: number;
}

export default function KaraokeMonthlyList({ onSelectSong, paddingBottom }: Props) {
  const { status, month, data, error, stepMonth } = useKaraokeStore(
    useShallow((s) => ({
      status: s.monthly.status,
      month: s.monthly.month,
      data: s.monthly.data,
      error: s.monthly.error,
      stepMonth: s.stepMonth,
    })),
  );

  const sections = useMemo<ArtistSection[]>(
    () => (data?.artists ?? []).map((group) => ({ artist: group.artist, data: group.songs })),
    [data],
  );

  const handlePrev = useCallback(() => stepMonth(-1), [stepMonth]);
  const handleNext = useCallback(() => stepMonth(1), [stepMonth]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<KaraokeSongItem, ArtistSection> }) => (
      <KaraokeSectionHeader main={section.artist} count={section.data.length} />
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: KaraokeSongItem }) => (
      <KaraokeSongRow item={item} onPress={onSelectSong} showArtist={false} />
    ),
    [onSelectSong],
  );

  const atCurrentMonth = month >= currentYearMonth();

  return (
    <View style={styles.container}>
      <View style={styles.monthNav}>
        <View style={styles.monthLabel}>
          <Text style={styles.month}>{formatYearMonth(month)}</Text>
          {data ? <Text style={styles.count}>{data.songCount}곡</Text> : null}
        </View>
        <View style={styles.arrows}>
          <TouchableOpacity style={styles.arrowButton} onPress={handlePrev} hitSlop={4}>
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.arrowButton}
            onPress={handleNext}
            disabled={atCurrentMonth}
            hitSlop={4}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={atCurrentMonth ? Colors.border : Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {status === 'loading' && sections.length === 0 ? (
        <ActivityIndicator color={Colors.primary} style={styles.center} />
      ) : status === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.message}>{error}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={<EmptyState />}
          contentContainerStyle={{ paddingBottom }}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
        />
      )}
    </View>
  );
}

const keyExtractor = (item: KaraokeSongItem, index: number) =>
  `${item.title}-${item.artist}-${index}`;

const EmptyState = React.memo(function EmptyState() {
  return (
    <View style={styles.center}>
      <Text style={styles.message}>이 달에 올라온 신곡이 없어요</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  monthNav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Dimens.screenPadding,
  },
  monthLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  month: {
    fontSize: 17,
    lineHeight: 25,
    color: Colors.textPrimary,
    ...fontStyle('heading', '700'),
  },
  count: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
    ...fontStyle('body', '500'),
  },
  arrows: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    paddingTop: 60,
    alignItems: 'center',
  },
  message: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
