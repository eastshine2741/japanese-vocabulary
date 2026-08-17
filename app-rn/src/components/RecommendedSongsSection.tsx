import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import ArtworkImage from './ArtworkImage';
import SkeletonBox from './SkeletonLoading';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useRecommendationStore } from '../stores/recommendationStore';
import { Colors, Dimens } from '../theme/theme';
import { RecommendedSongItem } from '../types/song';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Pencil recCarousel (frame AlUIg): card width 272 on a 402-wide frame.
// Kept as a ratio so the carousel adapts to device width while preserving
// the "peek" of the next card.
const CARD_WIDTH_RATIO = 272 / 402;
const CARD_GAP = 14;
const CARD_INNER_GAP = 12;
const SKELETON_CARD_COUNT = 4;
const SKELETON_TITLE_RATIO = 169 / 272;
const SKELETON_ARTIST_RATIO = 109 / 272;

interface RecommendedSongCardProps {
  item: RecommendedSongItem;
  cardWidth: number;
  onPress: (songId: number) => void;
}

const RecommendedSongCard = React.memo(function RecommendedSongCard({
  item,
  cardWidth,
  onPress,
}: RecommendedSongCardProps) {
  const handlePress = useCallback(() => {
    onPress(item.songId);
  }, [item.songId, onPress]);

  return (
    <TouchableOpacity
      style={[styles.item, { width: cardWidth }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={[styles.coverShadow, { width: cardWidth, height: cardWidth }]}>
        <ArtworkImage
          url={item.artworkUrl}
          size={cardWidth}
          cornerRadius={Dimens.cardCornerRadius}
        />
      </View>
      <Text style={[styles.title, { width: cardWidth }]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={[styles.artist, { width: cardWidth }]} numberOfLines={1}>
        {item.artist}
      </Text>
    </TouchableOpacity>
  );
});

interface SkeletonCardProps {
  cardWidth: number;
}

const SkeletonCard = React.memo(function SkeletonCard({ cardWidth }: SkeletonCardProps) {
  return (
    <View style={[styles.item, { width: cardWidth }]}>
      <SkeletonBox
        width={cardWidth}
        height={cardWidth}
        borderRadius={Dimens.cardCornerRadius}
        color={Colors.elevated}
      />
      <SkeletonBox
        width={cardWidth * SKELETON_TITLE_RATIO}
        height={16}
        color={Colors.elevated}
      />
      <SkeletonBox
        width={cardWidth * SKELETON_ARTIST_RATIO}
        height={13}
        color={Colors.elevated}
      />
    </View>
  );
});

export default function RecommendedSongsSection() {
  const navigation = useNavigation<Nav>();
  const { width: windowWidth } = useWindowDimensions();

  const { songs, status, load } = useRecommendationStore(
    useShallow(s => ({ songs: s.songs, status: s.status, load: s.load })),
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const cardWidth = useMemo(
    () => Math.round(windowWidth * CARD_WIDTH_RATIO),
    [windowWidth],
  );

  const handleSongPress = useCallback(
    (songId: number) => {
      navigation.navigate('SongDetail', { songId, origin: 'Home' });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<RecommendedSongItem>) => (
      <RecommendedSongCard item={item} cardWidth={cardWidth} onPress={handleSongPress} />
    ),
    [cardWidth, handleSongPress],
  );

  const keyExtractor = useCallback((item: RecommendedSongItem) => String(item.id), []);

  if (songs.length === 0 && status !== 'loading') {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>이번 주 추천곡</Text>
        <Text style={styles.sectionSubtitle}>요즘 인기 있는 노래를 모았어요.</Text>
      </View>
      {songs.length > 0 ? (
        <FlatList
          data={songs}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={styles.listContent}
          snapToInterval={cardWidth + CARD_GAP}
          snapToAlignment="start"
          decelerationRate="fast"
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
            <React.Fragment key={index}>
              {index > 0 && <Separator />}
              <SkeletonCard cardWidth={cardWidth} />
            </React.Fragment>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  header: {
    gap: 4,
    paddingHorizontal: Dimens.screenPadding,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: Dimens.screenPadding,
  },
  separator: {
    width: CARD_GAP,
  },
  item: {
    gap: CARD_INNER_GAP,
  },
  coverShadow: {
    borderRadius: Dimens.cardCornerRadius,
    // Opaque background: Android elevation and iOS shadows do not render
    // behind a fully transparent view.
    backgroundColor: Colors.background,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  artist: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textMuted,
  },
});
