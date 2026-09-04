import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Image,
  ListRenderItemInfo,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import ArtworkImage from '../ArtworkImage';
import SkeletonBox from '../SkeletonLoading';
import { useHomeStore } from '../../stores/homeStore';
import { useRecommendationStore } from '../../stores/recommendationStore';
import { useSearchHistoryStore } from '../../stores/searchHistoryStore';
import { Colors, Dimens } from '../../theme/theme';
import { RecentSongItem, RecommendedSongItem } from '../../types/song';

const TRENDING_TERMS = ['YOASOBI', '夜に駆ける', '米津玄師', '紅蓮華', 'Official髭男dism'];
const MAX_TERMS = 5;

const RECENT_COVER_SIZE = 84;
const RECENT_COVER_RADIUS = 10;

const REC_CARD_WIDTH_RATIO = 152 / 402;
const REC_CARD_ASPECT = 200 / 152;
const REC_CARD_GAP = 12;
const REC_CARD_RADIUS = 14;
const REC_CARD_PADDING = 12;
const REC_SKELETON_COUNT = 4;
const SCRIM_COLORS = ['#00000000', '#00000000', '#000000A8', '#000000ED'] as const;
const SCRIM_LOCATIONS = [0, 0.34, 0.7, 1] as const;

interface SearchDiscoverySectionsProps {
  onSelectTerm: (term: string) => void;
  onSelectSong: (songId: number) => void;
}

interface RecentSongProps {
  item: RecentSongItem;
  onPress: (songId: number) => void;
}

const RecentSongCard = React.memo(function RecentSongCard({
  item,
  onPress,
}: RecentSongProps) {
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <TouchableOpacity style={styles.recentSongCard} onPress={handlePress} activeOpacity={0.72}>
      <ArtworkImage
        url={item.artworkUrl}
        size={RECENT_COVER_SIZE}
        cornerRadius={RECENT_COVER_RADIUS}
      />
      <Text style={styles.recentSongTitle} numberOfLines={1}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
});

interface TermRowProps {
  term: string;
  kind: 'recent' | 'trending';
  onSelect: (term: string) => void;
  onRemove: (term: string) => void;
}

const TermRow = React.memo(function TermRow({
  term,
  kind,
  onSelect,
  onRemove,
}: TermRowProps) {
  const handleSelect = useCallback(() => {
    onSelect(term);
  }, [onSelect, term]);

  const handleRemove = useCallback(() => {
    onRemove(term);
  }, [onRemove, term]);

  return (
    <TouchableOpacity style={styles.termRow} onPress={handleSelect} activeOpacity={0.72}>
      <Ionicons
        name={kind === 'recent' ? 'time-outline' : 'trending-up-outline'}
        size={18}
        color={Colors.textMuted}
      />
      <Text style={styles.termText} numberOfLines={1}>
        {term}
      </Text>
      {kind === 'recent' ? (
        <TouchableOpacity onPress={handleRemove} hitSlop={8}>
          <Ionicons name="close" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
});

interface RecommendedCardProps {
  item: RecommendedSongItem;
  cardWidth: number;
  cardHeight: number;
  onPress: (songId: number) => void;
}

const RecommendedCard = React.memo(function RecommendedCard({
  item,
  cardWidth,
  cardHeight,
  onPress,
}: RecommendedCardProps) {
  const handlePress = useCallback(() => {
    onPress(item.songId);
  }, [item.songId, onPress]);

  return (
    <TouchableOpacity
      style={[styles.recommendedCard, { width: cardWidth, height: cardHeight }]}
      onPress={handlePress}
      activeOpacity={0.76}
    >
      {item.artworkUrl ? (
        <Image
          source={{ uri: item.artworkUrl }}
          style={styles.recommendedArtwork}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.recommendedArtwork, styles.recommendedPlaceholder]} />
      )}
      <View style={styles.recommendedTint} pointerEvents="none" />
      <LinearGradient
        colors={SCRIM_COLORS}
        locations={SCRIM_LOCATIONS}
        style={styles.recommendedScrim}
        pointerEvents="none"
      />
      <View style={styles.recommendedText}>
        <Text style={styles.recommendedTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.recommendedArtist} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

interface SkeletonCardProps {
  cardWidth: number;
  cardHeight: number;
}

const RecommendedSkeletonCard = React.memo(function RecommendedSkeletonCard({
  cardWidth,
  cardHeight,
}: SkeletonCardProps) {
  return (
    <SkeletonBox
      width={cardWidth}
      height={cardHeight}
      borderRadius={REC_CARD_RADIUS}
      color={Colors.elevated}
    />
  );
});

function RecentSongSeparator() {
  return <View style={styles.recentSeparator} />;
}

function RecommendedSeparator() {
  return <View style={styles.recommendedSeparator} />;
}

export default function SearchDiscoverySections({
  onSelectTerm,
  onSelectSong,
}: SearchDiscoverySectionsProps) {
  const { width: windowWidth } = useWindowDimensions();
  const { recentSongs, loadRecentSongs } = useHomeStore(
    useShallow(s => ({ recentSongs: s.songs, loadRecentSongs: s.load })),
  );
  const { terms, loadTerms, removeTerm } = useSearchHistoryStore(
    useShallow(s => ({ terms: s.terms, loadTerms: s.load, removeTerm: s.remove })),
  );
  const { recommendedSongs, recommendationStatus, loadRecommendations } = useRecommendationStore(
    useShallow(s => ({
      recommendedSongs: s.songs,
      recommendationStatus: s.status,
      loadRecommendations: s.load,
    })),
  );

  useFocusEffect(
    useCallback(() => {
      loadRecentSongs();
      loadTerms();
      loadRecommendations();
    }, [loadRecentSongs, loadTerms, loadRecommendations]),
  );

  const termRows = useMemo(() => {
    const recent = terms.slice(0, MAX_TERMS).map(term => ({ term, kind: 'recent' as const }));
    if (recent.length >= MAX_TERMS) return recent;
    const seen = new Set(recent.map(row => row.term));
    const trending = TRENDING_TERMS.filter(term => !seen.has(term))
      .slice(0, MAX_TERMS - recent.length)
      .map(term => ({ term, kind: 'trending' as const }));
    return [...recent, ...trending];
  }, [terms]);

  const cardWidth = useMemo(
    () => Math.round(windowWidth * REC_CARD_WIDTH_RATIO),
    [windowWidth],
  );
  const cardHeight = useMemo(() => Math.round(cardWidth * REC_CARD_ASPECT), [cardWidth]);

  const renderRecentSong = useCallback(
    ({ item }: ListRenderItemInfo<RecentSongItem>) => (
      <RecentSongCard item={item} onPress={onSelectSong} />
    ),
    [onSelectSong],
  );

  const renderRecommendedSong = useCallback(
    ({ item }: ListRenderItemInfo<RecommendedSongItem>) => (
      <RecommendedCard
        item={item}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        onPress={onSelectSong}
      />
    ),
    [cardWidth, cardHeight, onSelectSong],
  );

  const recentKeyExtractor = useCallback((item: RecentSongItem) => String(item.id), []);
  const recommendedKeyExtractor = useCallback((item: RecommendedSongItem) => String(item.id), []);

  return (
    <View style={styles.container}>
      {recentSongs.length > 0 ? (
        <FlatList
          data={recentSongs}
          renderItem={renderRecentSong}
          keyExtractor={recentKeyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          ItemSeparatorComponent={RecentSongSeparator}
          contentContainerStyle={styles.recentList}
        />
      ) : null}

      <View style={styles.termsSection}>
        {termRows.map(row => (
          <TermRow
            key={`${row.kind}:${row.term}`}
            term={row.term}
            kind={row.kind}
            onSelect={onSelectTerm}
            onRemove={removeTerm}
          />
        ))}
      </View>

      {recommendedSongs.length > 0 || recommendationStatus === 'loading' ? (
        <View style={styles.recommendedSection}>
          <View style={styles.recommendedHeader}>
            <Text style={styles.recommendedHeaderTitle}>이런 곡은 어때요?</Text>
            <Text style={styles.recommendedHeaderSubtitle}>요즘 인기 있는 노래를 모았어요.</Text>
          </View>

          {recommendedSongs.length > 0 ? (
            <FlatList
              data={recommendedSongs}
              renderItem={renderRecommendedSong}
              keyExtractor={recommendedKeyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              ItemSeparatorComponent={RecommendedSeparator}
              contentContainerStyle={styles.recommendedList}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recommendedList}
            >
              {Array.from({ length: REC_SKELETON_COUNT }).map((_, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <RecommendedSeparator />}
                  <RecommendedSkeletonCard cardWidth={cardWidth} cardHeight={cardHeight} />
                </React.Fragment>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 28,
    paddingTop: 12,
    paddingBottom: 28,
  },
  recentList: {
    paddingHorizontal: Dimens.screenPadding,
  },
  recentSeparator: {
    width: 12,
  },
  recentSongCard: {
    width: RECENT_COVER_SIZE,
    gap: 6,
  },
  recentSongTitle: {
    width: RECENT_COVER_SIZE,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  termsSection: {
    paddingHorizontal: Dimens.screenPadding,
    gap: 2,
  },
  termRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  termText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  recommendedSection: {
    gap: 14,
  },
  recommendedHeader: {
    gap: 4,
    paddingHorizontal: Dimens.screenPadding,
  },
  recommendedHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  recommendedHeaderSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  recommendedList: {
    paddingHorizontal: Dimens.screenPadding,
  },
  recommendedSeparator: {
    width: REC_CARD_GAP,
  },
  recommendedCard: {
    borderRadius: REC_CARD_RADIUS,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: Colors.elevated,
  },
  recommendedArtwork: {
    ...StyleSheet.absoluteFillObject,
  },
  recommendedPlaceholder: {
    backgroundColor: Colors.cardBorder,
  },
  recommendedTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000014',
    borderRadius: REC_CARD_RADIUS,
  },
  recommendedScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  recommendedText: {
    gap: 3,
    paddingHorizontal: REC_CARD_PADDING,
    paddingBottom: REC_CARD_PADDING,
  },
  recommendedTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recommendedArtist: {
    fontSize: 11,
    color: '#FFFFFFB8',
  },
});
