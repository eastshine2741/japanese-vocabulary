import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
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
import { LinearGradient } from 'expo-linear-gradient';
import SkeletonBox from './SkeletonLoading';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useRecommendationStore } from '../stores/recommendationStore';
import { Colors, Dimens } from '../theme/theme';
import { RecommendedSongItem } from '../types/song';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Pencil recCarousel (frames AlUIg / CXbuw): card 200x264 on a 402-wide frame.
// Width is kept as a ratio so the carousel adapts to device width while
// preserving the "peek" of the next card; the 200:264 aspect is fixed.
const CARD_WIDTH_RATIO = 200 / 402;
const CARD_ASPECT = 264 / 200;
const CARD_GAP = 12;
const CARD_RADIUS = 14;
const CARD_PADDING = 14;
const CARD_STROKE = '#00000024';
const CARD_TINT = '#00000014';
const SCRIM_COLORS = ['#00000000', '#00000000', '#000000A8', '#000000ED'] as const;
const SCRIM_LOCATIONS = [0, 0.34, 0.7, 1] as const;
const TITLE_FONT_SIZE = 15;
const TITLE_LINE_HEIGHT = TITLE_FONT_SIZE * 1.32;
const SKELETON_CARD_COUNT = 4;

interface RecommendedSongCardProps {
  item: RecommendedSongItem;
  cardWidth: number;
  cardHeight: number;
  onPress: (songId: number) => void;
}

const RecommendedSongCard = React.memo(function RecommendedSongCard({
  item,
  cardWidth,
  cardHeight,
  onPress,
}: RecommendedSongCardProps) {
  const handlePress = useCallback(() => {
    onPress(item.songId);
  }, [item.songId, onPress]);

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth, height: cardHeight }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {item.artworkUrl ? (
        <Image source={{ uri: item.artworkUrl }} style={styles.artwork} resizeMode="cover" />
      ) : (
        <View style={[styles.artwork, styles.artworkPlaceholder]} />
      )}
      {/* Pencil card fill: artwork image + #00000014 tint, inner 1px stroke. */}
      <View style={styles.tint} pointerEvents="none" />
      <LinearGradient
        colors={SCRIM_COLORS}
        locations={SCRIM_LOCATIONS}
        style={styles.scrim}
        pointerEvents="none"
      />
      <View style={styles.cardText}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
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

const SkeletonCard = React.memo(function SkeletonCard({
  cardWidth,
  cardHeight,
}: SkeletonCardProps) {
  return (
    <SkeletonBox
      width={cardWidth}
      height={cardHeight}
      borderRadius={CARD_RADIUS}
      color={Colors.elevated}
    />
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
  const cardHeight = useMemo(() => Math.round(cardWidth * CARD_ASPECT), [cardWidth]);

  const handleSongPress = useCallback(
    (songId: number) => {
      navigation.navigate('SongDetail', { songId, origin: 'Home' });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<RecommendedSongItem>) => (
      <RecommendedSongCard
        item={item}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        onPress={handleSongPress}
      />
    ),
    [cardWidth, cardHeight, handleSongPress],
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
              <SkeletonCard cardWidth={cardWidth} cardHeight={cardHeight} />
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
  card: {
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: Colors.elevated,
  },
  artwork: {
    ...StyleSheet.absoluteFillObject,
  },
  artworkPlaceholder: {
    backgroundColor: Colors.cardBorder,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CARD_TINT,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: CARD_STROKE,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  cardText: {
    gap: 3,
    paddingHorizontal: CARD_PADDING,
    paddingBottom: CARD_PADDING,
  },
  title: {
    fontSize: TITLE_FONT_SIZE,
    lineHeight: TITLE_LINE_HEIGHT,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  artist: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FFFFFFB8',
  },
});
