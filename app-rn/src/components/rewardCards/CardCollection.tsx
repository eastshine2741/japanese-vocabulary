import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import ArtistCardThumb from './ArtistCardThumb';
import SongCardThumb from './SongCardThumb';
import { CARD_SORT_LABEL, CARD_SORT_ORDER, CardSort, sortCards } from './cardWear';
import { useCardFonts } from './cardTheme';
import { ArtistRewardCard, SongRewardCard } from './types';

interface Props {
  songCards: SongRewardCard[];
  artistCards: ArtistRewardCard[];
  /** 화면 좌우 여백을 뺀 콘텐츠 폭. */
  contentWidth: number;
  sidePadding: number;
  onPressCard: (card: SongRewardCard) => void;
  onPressArtistCard: (card: ArtistRewardCard) => void;
}

const GRID_GAP = 12;
const COLUMNS = 3;
const ARTIST_CARD_WIDTH = 240;

function CardCollection({ songCards, artistCards, contentWidth, sidePadding, onPressCard, onPressArtistCard }: Props) {
  const fonts = useCardFonts();
  const [sort, setSort] = useState<CardSort>('level');
  const handleSort = useCallback(() => {
    setSort((prev) => CARD_SORT_ORDER[(CARD_SORT_ORDER.indexOf(prev) + 1) % CARD_SORT_ORDER.length]);
  }, []);

  const rows = useMemo(() => {
    const sorted = sortCards(songCards, sort);
    const out: SongRewardCard[][] = [];
    for (let i = 0; i < sorted.length; i += COLUMNS) out.push(sorted.slice(i, i + COLUMNS));
    return out;
  }, [songCards, sort]);

  const thumbWidth = (contentWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

  return (
    <View style={styles.root}>
      <View style={styles.section}>
        <View style={styles.head}>
          <Text style={styles.headTitle}>아티스트 카드</Text>
          <Text style={styles.headCount}>{artistCards.length}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -sidePadding }}
          contentContainerStyle={[styles.artistRow, { paddingHorizontal: sidePadding }]}
        >
          {artistCards.map((card) => (
            <ArtistCardThumb key={card.id} card={card} width={ARTIST_CARD_WIDTH} fonts={fonts} onPress={onPressArtistCard} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <View style={styles.head}>
          <Text style={styles.headTitle}>곡 카드</Text>
          <Text style={styles.headCount}>{songCards.length}</Text>
          <View style={styles.spacer} />
          <Pressable onPress={handleSort} style={({ pressed }) => [styles.sortChip, pressed && styles.pressed]} hitSlop={6}>
            <Text style={styles.sortLabel}>{CARD_SORT_LABEL[sort]}</Text>
            <Feather name="chevron-down" size={14} color={Colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {rows.map((row) => (
            <View key={row.map((c) => c.id).join()} style={styles.gridRow}>
              {row.map((card) => (
                <SongCardThumb key={card.id} card={card} width={thumbWidth} fonts={fonts} onPress={onPressCard} />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export default React.memo(CardCollection);

const styles = StyleSheet.create({
  root: { gap: 28 },
  section: { gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  grid: { gap: 14 },
  gridRow: { flexDirection: 'row', gap: GRID_GAP },
});
