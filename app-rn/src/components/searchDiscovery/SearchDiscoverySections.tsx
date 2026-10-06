import React, { useCallback } from 'react';
import {
  FlatList,
  Image,
  ListRenderItemInfo,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import ArtworkImage from '../ArtworkImage';
import KaraokeNewSection from '../karaoke/KaraokeNewSection';
import { useHomeStore } from '../../stores/homeStore';
import { useKaraokeStore } from '../../stores/karaokeStore';
import { useRecommendationStore } from '../../stores/recommendationStore';
import { Colors, Dimens } from '../../theme/theme';
import { RecentSongItem, RecommendedSongItem } from '../../types/song';

const SECTION_LABEL_HEIGHT = 22;
const SECTION_LABEL_FONT_SIZE = 15;

const RECENT_COVER_SIZE = 72;
const RECENT_COVER_RADIUS = 12;
const RECENT_CARD_HEIGHT = 96;
const RECENT_TITLE_HEIGHT = 16;

const REC_CARD_WIDTH = 152;
const REC_CARD_HEIGHT = 200;
const REC_CARD_GAP = 12;
const REC_CARD_RADIUS = 12;
const REC_CARD_PADDING = 12;
const SCRIM_COLORS = ['#00000000', '#00000000', '#000000A8', '#000000ED'] as const;
const SCRIM_LOCATIONS = [0, 0.34, 0.7, 1] as const;

interface SearchDiscoverySectionsProps {
  onSelectSong: (songId: number) => void;
  onPressKaraokeNewSongs: () => void;
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
      <View style={styles.recentSongTitleClip}>
        <Text style={styles.recentSongTitle} numberOfLines={1} ellipsizeMode="tail">
          {item.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

interface RecommendedCardProps {
  item: RecommendedSongItem;
  onPress: (songId: number) => void;
}

const RecommendedCard = React.memo(function RecommendedCard({
  item,
  onPress,
}: RecommendedCardProps) {
  const handlePress = useCallback(() => {
    onPress(item.songId);
  }, [item.songId, onPress]);

  return (
    <TouchableOpacity
      style={styles.recommendedCard}
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
      <LinearGradient
        colors={SCRIM_COLORS}
        locations={SCRIM_LOCATIONS}
        style={styles.recommendedScrim}
        pointerEvents="none"
      />
      <View style={styles.recommendedText}>
        <View style={styles.recommendedTitleClip}>
          <Text style={styles.recommendedTitle} numberOfLines={1} ellipsizeMode="clip">
            {item.title}
          </Text>
        </View>
        <View style={styles.recommendedArtistClip}>
          <Text style={styles.recommendedArtist} numberOfLines={1} ellipsizeMode="clip">
            {item.artist}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

function RecentSongSeparator() {
  return <View style={styles.recentSeparator} />;
}

function RecommendedSeparator() {
  return <View style={styles.recommendedSeparator} />;
}

export default function SearchDiscoverySections({
  onSelectSong,
  onPressKaraokeNewSongs,
}: SearchDiscoverySectionsProps) {
  const { recentSongs, loadRecentSongs } = useHomeStore(
    useShallow(s => ({ recentSongs: s.songs, loadRecentSongs: s.load })),
  );
  const { karaokeGroups, loadKaraoke } = useKaraokeStore(
    useShallow(s => ({ karaokeGroups: s.daily.groups, loadKaraoke: s.loadDaily })),
  );
  const { recommendedSongs, loadRecommendations } = useRecommendationStore(
    useShallow(s => ({
      recommendedSongs: s.songs,
      loadRecommendations: s.load,
    })),
  );

  useFocusEffect(
    useCallback(() => {
      loadRecentSongs();
      loadKaraoke();
      loadRecommendations();
    }, [loadRecentSongs, loadKaraoke, loadRecommendations]),
  );

  // 가장 최근 등재일 한 묶음만 미리 보여주고, 나머지는 노래방 신곡 화면에서 본다.
  const latestKaraokeGroup = karaokeGroups[0] ?? null;

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
        onPress={onSelectSong}
      />
    ),
    [onSelectSong],
  );

  const recentKeyExtractor = useCallback((item: RecentSongItem) => String(item.id), []);
  const recommendedKeyExtractor = useCallback((item: RecommendedSongItem) => String(item.id), []);

  return (
    <View style={styles.container}>
      {recentSongs.length > 0 ? (
        <View style={styles.recentSongsSection}>
          <SectionLabel>최근 본 곡</SectionLabel>
          <FlatList
            data={recentSongs}
            renderItem={renderRecentSong}
            keyExtractor={recentKeyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            ItemSeparatorComponent={RecentSongSeparator}
            contentContainerStyle={styles.recentList}
            style={styles.recentListWrap}
          />
        </View>
      ) : null}

      {latestKaraokeGroup ? (
        <KaraokeNewSection
          group={latestKaraokeGroup}
          onPressMore={onPressKaraokeNewSongs}
          onSelectSong={onSelectSong}
        />
      ) : null}

      {recommendedSongs.length > 0 ? (
        <View style={styles.recommendedSection}>
          <SectionLabel>이런 곡은 어때요?</SectionLabel>

          <FlatList
            data={recommendedSongs}
            renderItem={renderRecommendedSong}
            keyExtractor={recommendedKeyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            ItemSeparatorComponent={RecommendedSeparator}
            contentContainerStyle={styles.recommendedList}
          />
        </View>
      ) : null}
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabel}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 32,
    paddingTop: 4,
    paddingBottom: 8,
  },
  recentSongsSection: {
    gap: 8,
  },
  sectionLabelRow: {
    height: SECTION_LABEL_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: Dimens.screenPadding,
  },
  sectionLabel: {
    fontSize: SECTION_LABEL_FONT_SIZE,
    lineHeight: SECTION_LABEL_HEIGHT,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  recentListWrap: {
    height: RECENT_CARD_HEIGHT,
  },
  recentList: {
    paddingHorizontal: Dimens.screenPadding,
  },
  recentSeparator: {
    width: 16,
  },
  recentSongCard: {
    width: RECENT_COVER_SIZE,
    height: RECENT_CARD_HEIGHT,
    gap: 8,
    overflow: 'hidden',
  },
  recentSongTitleClip: {
    width: RECENT_COVER_SIZE,
    height: RECENT_TITLE_HEIGHT,
    overflow: 'hidden',
  },
  recentSongTitle: {
    width: RECENT_COVER_SIZE,
    height: RECENT_TITLE_HEIGHT,
    fontSize: 11,
    lineHeight: RECENT_TITLE_HEIGHT,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  recommendedSection: {
    gap: 8,
    paddingTop: 8,
  },
  recommendedList: {
    paddingHorizontal: Dimens.screenPadding,
  },
  recommendedSeparator: {
    width: REC_CARD_GAP,
  },
  recommendedCard: {
    width: REC_CARD_WIDTH,
    height: REC_CARD_HEIGHT,
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
  recommendedScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  recommendedText: {
    width: 128,
    height: 40,
    gap: 2,
    marginLeft: REC_CARD_PADDING,
    marginBottom: REC_CARD_PADDING,
  },
  recommendedTitleClip: {
    width: 128,
    height: 20,
    overflow: 'hidden',
  },
  recommendedTitle: {
    width: 128,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recommendedArtistClip: {
    width: 128,
    height: 18,
    overflow: 'hidden',
  },
  recommendedArtist: {
    width: 128,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400',
    color: '#FFFFFFB8',
  },
});
