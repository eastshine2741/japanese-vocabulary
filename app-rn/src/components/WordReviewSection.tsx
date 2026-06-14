import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import ArtworkImage from './ArtworkImage';
import { useDeckListStore } from '../stores/deckListStore';
import { flashcardApi } from '../api/flashcardApi';
import { FlashcardStatsResponse } from '../types/flashcard';
import { SongDeckSummary } from '../types/deck';
import { Colors, Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ROWS_PER_PAGE = 4;
// Gap between pages, and how many px of the next page's row are visible from the
// screen's right edge (the peek that signals the pager scrolls horizontally).
const PAGE_GAP = 24;
const PAGE_PEEK = 12;

type RowItem =
  | { kind: 'all'; total: number; due: number }
  | { kind: 'deck'; deck: SongDeckSummary };

interface DeckRowProps {
  item: RowItem;
  onPress: (deckId: number | null) => void;
}

const DeckRow = React.memo(function DeckRow({ item, onPress }: DeckRowProps) {
  const deckId = item.kind === 'all' ? null : item.deck.deckId;
  const handlePress = useCallback(() => onPress(deckId), [onPress, deckId]);

  const title = item.kind === 'all' ? '전체 단어장' : item.deck.title;
  const sub =
    item.kind === 'all'
      ? `${item.total}단어`
      : `${item.deck.artist} · ${item.deck.wordCount}단어`;
  const due = item.kind === 'all' ? item.due : item.deck.dueCount;
  const showDue = item.kind === 'all' ? due > 0 : item.deck.dueCount > 0;

  return (
    <TouchableOpacity style={styles.row} onPress={handlePress} activeOpacity={0.7}>
      {item.kind === 'all' ? (
        <View style={styles.allArt}>
          <Ionicons name="albums" size={22} color={Colors.primary} />
        </View>
      ) : (
        <ArtworkImage url={item.deck.artworkUrl} size={44} cornerRadius={14} />
      )}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {showDue && <Text style={styles.dueCount}>{due}</Text>}
    </TouchableOpacity>
  );
});

function WordReviewSection() {
  const navigation = useNavigation<Nav>();
  const songDecks = useDeckListStore(useShallow(s => s.songDecks));
  const load = useDeckListStore(s => s.load);
  const [stats, setStats] = useState<FlashcardStatsResponse | null>(null);
  const [pagerWidth, setPagerWidth] = useState(0);

  useFocusEffect(
    useCallback(() => {
      load();
      flashcardApi.getStats().then(setStats).catch(() => {});
    }, [load])
  );

  const handleHeaderPress = useCallback(() => {
    navigation.navigate('DeckList');
  }, [navigation]);

  const handleRowPress = useCallback(
    (deckId: number | null) => {
      navigation.navigate('DeckDetail', { deckId });
    },
    [navigation]
  );

  const handlePagerLayout = useCallback((e: LayoutChangeEvent) => {
    setPagerWidth(e.nativeEvent.layout.width);
  }, []);

  const pages = useMemo(() => {
    const rows: RowItem[] = [
      { kind: 'all', total: stats?.total ?? 0, due: stats?.due ?? 0 },
      ...songDecks.map<RowItem>(deck => ({ kind: 'deck', deck })),
    ];
    const chunks: RowItem[][] = [];
    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
      chunks.push(rows.slice(i, i + ROWS_PER_PAGE));
    }
    return chunks;
  }, [songDecks, stats]);

  // Each page is narrower than the viewport so the next page peeks on the right
  // (gap + peek), telling the user the pager scrolls. A lone page fills the full
  // content width (no peek to reveal).
  const fullWidth = pagerWidth - Dimens.screenPadding * 2;
  const hasMultiplePages = pages.length > 1;
  const pageWidth = hasMultiplePages
    ? pagerWidth - Dimens.screenPadding - PAGE_GAP - PAGE_PEEK
    : fullWidth;
  // The last page must scroll fully to the left edge so the previous page (its
  // due-count number) is hidden — that needs gap+peek of trailing room beyond
  // the normal screen margin.
  const trailingPad = hasMultiplePages
    ? PAGE_GAP + PAGE_PEEK
    : Dimens.screenPadding;

  const segments = useMemo(() => {
    if (!stats) return [];
    return [
      { count: stats.review, color: Colors.stateReview },
      { count: stats.learning, color: Colors.stateRetrievability },
      { count: stats.newCount, color: Colors.stateRelearning },
    ].filter(s => s.count > 0);
  }, [stats]);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.header}
        onPress={handleHeaderPress}
        activeOpacity={0.7}
      >
        <Text style={styles.headerTitle}>단어 복습</Text>
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </TouchableOpacity>

      {stats && (
        <View style={styles.reviewSummary}>
          <View style={styles.segBar}>
            {segments.map((s, i) => (
              <View
                key={i}
                style={{ flex: s.count, height: 8, backgroundColor: s.color }}
              />
            ))}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: Colors.stateReview }]} />
              <Text style={styles.legendText}>외운 단어 {stats.review}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: Colors.stateRetrievability }]} />
              <Text style={styles.legendText}>외우는 중 {stats.learning}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: Colors.stateRelearning }]} />
              <Text style={styles.legendText}>새 단어 {stats.newCount}</Text>
            </View>
          </View>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={pageWidth + PAGE_GAP}
        snapToAlignment="start"
        contentContainerStyle={[styles.pagerContent, { paddingRight: trailingPad }]}
        onLayout={handlePagerLayout}
      >
        {pageWidth > 0 &&
          pages.map((page, pageIndex) => (
            <View
              key={pageIndex}
              style={[
                styles.page,
                {
                  width: pageWidth,
                  marginRight: pageIndex < pages.length - 1 ? PAGE_GAP : 0,
                },
              ]}
            >
              {page.map(item => (
                <DeckRow
                  key={item.kind === 'all' ? 'all' : item.deck.deckId}
                  item={item}
                  onPress={handleRowPress}
                />
              ))}
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Dimens.screenPadding,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  reviewSummary: {
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: Dimens.screenPadding,
    gap: 9,
  },
  segBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 2,
  },
  legend: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  pagerContent: {
    paddingLeft: Dimens.screenPadding,
  },
  page: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  allArt: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  dueCount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
});

export default WordReviewSection;
