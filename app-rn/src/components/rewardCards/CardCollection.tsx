import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import ArtistCardThumb from './ArtistCardThumb';
import SongCardThumb from './SongCardThumb';
import { ArtistCardSlot, SongCardSlots } from './EmptyCardSlot';
import { CARD_SORT_LABEL, CARD_SORT_ORDER, CardSort, sortCards } from './cardWear';
import { sortArtistCards } from './artistGrade';
import { CardFonts, useCardFonts } from './cardTheme';
import { artistCardStacks, songCardStacks } from './cardKinds';
import { ArtistRewardCard, SongRewardCard } from './types';

interface Props {
  songCards: SongRewardCard[];
  artistCards: ArtistRewardCard[];
  /** 카드를 아직 못 받았다. 빈 목록일 때만 빈 안내 대신 로딩을 보인다. */
  loading: boolean;
  /** 화면 좌우 여백을 뺀 콘텐츠 폭. */
  contentWidth: number;
  sidePadding: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onPressCard: (card: SongRewardCard) => void;
  onPressArtistCard: (card: ArtistRewardCard) => void;
  onOpenArtistCards: () => void;
}

const GRID_GAP = 12;
const COLUMNS = 3;
const ARTIST_CARD_WIDTH = 240;
const ARTIST_PREVIEW_COUNT = 5;

// 등급마다 카드가 따로라 한 곡(아티스트)을 가장 높은 등급 카드 한 칸으로 묶는다.
function stackTops<T extends { id: string }>(stacks: { top: T; count: number }[]) {
  return {
    tops: stacks.map((stack) => stack.top),
    stackedIds: new Set(stacks.filter((stack) => stack.count > 1).map((stack) => stack.top.id)),
  };
}

// 곡 카드 한 장이 상세와 같은 앞면(낡음·포일·마스터 셰이더)을 그려서, 수십 장이 되면 화면 밖 카드를 그리지 않게 가상화한다.
function CardCollection({
  songCards,
  artistCards,
  loading,
  contentWidth,
  sidePadding,
  contentContainerStyle,
  onPressCard,
  onPressArtistCard,
  onOpenArtistCards,
}: Props) {
  const fonts = useCardFonts();
  const [sort, setSort] = useState<CardSort>('recent');
  const handleSort = useCallback(() => {
    setSort((prev) => CARD_SORT_ORDER[(CARD_SORT_ORDER.indexOf(prev) + 1) % CARD_SORT_ORDER.length]);
  }, []);

  const songStacks = useMemo(() => stackTops(songCardStacks(songCards)), [songCards]);
  const artistStacks = useMemo(() => stackTops(artistCardStacks(artistCards)), [artistCards]);
  const sortedSongs = useMemo(() => sortCards(songStacks.tops, sort), [songStacks, sort]);
  const artistPreview = useMemo(() => sortArtistCards(artistStacks.tops).slice(0, ARTIST_PREVIEW_COUNT), [artistStacks]);
  const thumbWidth = (contentWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

  const renderItem = useCallback(
    ({ item }: { item: SongRewardCard }) => (
      <SongCardThumb
        card={item}
        width={thumbWidth}
        fonts={fonts}
        stacked={songStacks.stackedIds.has(item.id)}
        onPress={onPressCard}
      />
    ),
    [thumbWidth, fonts, songStacks, onPressCard],
  );

  const songEmpty = loading ? <Loading /> : <SongCardSlots width={thumbWidth} gap={GRID_GAP} />;

  const header = (
    <CollectionHeader
      artistCount={artistStacks.tops.length}
      artistPreview={artistPreview}
      artistStackedIds={artistStacks.stackedIds}
      songCount={songStacks.tops.length}
      loading={loading}
      sort={sort}
      sidePadding={sidePadding}
      fonts={fonts}
      onSort={handleSort}
      onPressArtistCard={onPressArtistCard}
      onOpenArtistCards={onOpenArtistCards}
    />
  );

  return (
    <FlatList
      data={sortedSongs}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      numColumns={COLUMNS}
      ListHeaderComponent={header}
      columnWrapperStyle={styles.gridRow}
      ItemSeparatorComponent={RowGap}
      ListEmptyComponent={songEmpty}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      initialNumToRender={9}
      maxToRenderPerBatch={6}
      windowSize={5}
    />
  );
}

export default React.memo(CardCollection);

function keyExtractor(card: SongRewardCard) {
  return card.id;
}

function RowGap() {
  return <View style={styles.rowGap} />;
}

function Loading() {
  return <ActivityIndicator color={Colors.primary} style={styles.loading} />;
}

const CollectionHeader = React.memo(function CollectionHeader({
  artistCount,
  artistPreview,
  artistStackedIds,
  songCount,
  loading,
  sort,
  sidePadding,
  fonts,
  onSort,
  onPressArtistCard,
  onOpenArtistCards,
}: {
  artistCount: number;
  artistPreview: ArtistRewardCard[];
  artistStackedIds: ReadonlySet<string>;
  songCount: number;
  loading: boolean;
  sort: CardSort;
  sidePadding: number;
  fonts: CardFonts;
  onSort: () => void;
  onPressArtistCard: (card: ArtistRewardCard) => void;
  onOpenArtistCards: () => void;
}) {
  return (
    <View style={styles.headerRoot}>
      <View style={styles.section}>
        <Pressable onPress={onOpenArtistCards} disabled={artistCount === 0} style={({ pressed }) => [styles.head, styles.artistHead, pressed && styles.pressed]} hitSlop={6}>
          <Text style={styles.headTitle}>아티스트 카드</Text>
          <Text style={styles.headCount}>{artistCount}</Text>
          {artistCount > 0 && <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />}
        </Pressable>
        {artistCount === 0 ? (
          loading ? <Loading /> : <ArtistCardSlot width={ARTIST_CARD_WIDTH} />
        ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -sidePadding }}
          contentContainerStyle={[styles.artistRow, { paddingHorizontal: sidePadding }]}
        >
          {artistPreview.map((card) => (
            <ArtistCardThumb
              key={card.id}
              card={card}
              width={ARTIST_CARD_WIDTH}
              fonts={fonts}
              stacked={artistStackedIds.has(card.id)}
              onPress={onPressArtistCard}
            />
          ))}
          <Pressable onPress={onOpenArtistCards} style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}>
            <View style={styles.seeAllIcon}>
              <Ionicons name="arrow-forward" size={20} color={Colors.textPrimary} />
            </View>
            <Text style={styles.seeAllLabel}>전체 보기</Text>
          </Pressable>
        </ScrollView>
        )}
      </View>

      <View style={styles.head}>
        <Text style={styles.headTitle}>곡 카드</Text>
        <Text style={styles.headCount}>{songCount}</Text>
        <View style={styles.spacer} />
        {songCount > 0 && (
        <Pressable onPress={onSort} style={({ pressed }) => [styles.sortChip, pressed && styles.pressed]} hitSlop={6}>
          <Text style={styles.sortLabel}>{CARD_SORT_LABEL[sort]}</Text>
          <Feather name="chevron-down" size={14} color={Colors.textSecondary} />
        </Pressable>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  headerRoot: { gap: 28, marginBottom: 14 },
  section: { gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  artistHead: { alignSelf: 'flex-start' },
  headTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  headCount: { fontSize: 14, fontWeight: '500', color: Colors.textMuted, fontVariant: ['tabular-nums'] },
  spacer: { flex: 1 },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.elevated,
  },
  sortLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  pressed: { opacity: 0.6 },
  // 겹친 카드 모서리가 위로 삐져나와 잘리지 않게 둔다.
  artistRow: { gap: 12, paddingTop: 16 },
  seeAll: { width: 72, alignItems: 'center', justifyContent: 'center', gap: 8 },
  seeAllIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.elevated,
  },
  seeAllLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  loading: { paddingVertical: 24 },
  gridRow: { gap: GRID_GAP },
  rowGap: { height: 14 },
});
