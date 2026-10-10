import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import ArtistCardThumb from './ArtistCardThumb';
import SongCardThumb from './SongCardThumb';
import { CARD_SORT_LABEL, CARD_SORT_ORDER, CardSort, sortCards } from './cardWear';
import { sortArtistCards } from './artistGrade';
import { CardFonts, useCardFonts } from './cardTheme';
import { ArtistRewardCard, SongRewardCard } from './types';

interface Props {
  songCards: SongRewardCard[];
  artistCards: ArtistRewardCard[];
  /** 화면 좌우 여백을 뺀 콘텐츠 폭. */
  contentWidth: number;
  sidePadding: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onPressCard: (card: SongRewardCard) => void;
  onLongPressCard?: (card: SongRewardCard) => void;
  onPressArtistCard: (card: ArtistRewardCard) => void;
  onOpenArtistCards: () => void;
}

const GRID_GAP = 12;
const COLUMNS = 3;
const ARTIST_CARD_WIDTH = 240;
const ARTIST_PREVIEW_COUNT = 5;

// 곡 카드 한 장이 상세와 같은 앞면(낡음·포일·마스터 셰이더)을 그려서, 수십 장이 되면 화면 밖 카드를 그리지 않게 가상화한다.
function CardCollection({
  songCards,
  artistCards,
  contentWidth,
  sidePadding,
  contentContainerStyle,
  onPressCard,
  onLongPressCard,
  onPressArtistCard,
  onOpenArtistCards,
}: Props) {
  const fonts = useCardFonts();
  const [sort, setSort] = useState<CardSort>('level');
  const handleSort = useCallback(() => {
    setSort((prev) => CARD_SORT_ORDER[(CARD_SORT_ORDER.indexOf(prev) + 1) % CARD_SORT_ORDER.length]);
  }, []);

  const sortedSongs = useMemo(() => sortCards(songCards, sort), [songCards, sort]);
  const artistPreview = useMemo(() => sortArtistCards(artistCards).slice(0, ARTIST_PREVIEW_COUNT), [artistCards]);
  const thumbWidth = (contentWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

  const renderItem = useCallback(
    ({ item }: { item: SongRewardCard }) => (
      <SongCardThumb card={item} width={thumbWidth} fonts={fonts} onPress={onPressCard} onLongPress={onLongPressCard} />
    ),
    [thumbWidth, fonts, onPressCard, onLongPressCard],
  );

  const header = (
    <CollectionHeader
      artistCount={artistCards.length}
      artistPreview={artistPreview}
      songCount={songCards.length}
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

const CollectionHeader = React.memo(function CollectionHeader({
  artistCount,
  artistPreview,
  songCount,
  sort,
  sidePadding,
  fonts,
  onSort,
  onPressArtistCard,
  onOpenArtistCards,
}: {
  artistCount: number;
  artistPreview: ArtistRewardCard[];
  songCount: number;
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
        <Pressable onPress={onOpenArtistCards} style={({ pressed }) => [styles.head, styles.artistHead, pressed && styles.pressed]} hitSlop={6}>
          <Text style={styles.headTitle}>아티스트 카드</Text>
          <Text style={styles.headCount}>{artistCount}</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -sidePadding }}
          contentContainerStyle={[styles.artistRow, { paddingHorizontal: sidePadding }]}
        >
          {artistPreview.map((card) => (
            <ArtistCardThumb key={card.id} card={card} width={ARTIST_CARD_WIDTH} fonts={fonts} onPress={onPressArtistCard} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.head}>
        <Text style={styles.headTitle}>곡 카드</Text>
        <Text style={styles.headCount}>{songCount}</Text>
        <View style={styles.spacer} />
        <Pressable onPress={onSort} style={({ pressed }) => [styles.sortChip, pressed && styles.pressed]} hitSlop={6}>
          <Text style={styles.sortLabel}>{CARD_SORT_LABEL[sort]}</Text>
          <Feather name="chevron-down" size={14} color={Colors.textSecondary} />
        </Pressable>
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
  artistRow: { gap: 12 },
  gridRow: { gap: GRID_GAP },
  rowGap: { height: 14 },
});
