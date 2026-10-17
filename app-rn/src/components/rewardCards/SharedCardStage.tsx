import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import type { SharedRewardCardDto } from '../../types/rewardCard';
import ArtistCardShowcase from './ArtistCardShowcase';
import SongCardShowcase from './SongCardShowcase';
import { SHOWROOM, useCardFonts } from './cardTheme';
import { useArtColors } from './artColors';
import { toArtistCard, toSongCard } from './serverRewardCards';
import type { ArtistRewardCard, SongRewardCard } from './types';
import { useCardTilt } from './useCardTilt';

interface Props {
  shared: SharedRewardCardDto;
  width: number;
}

export interface SharedCards {
  songCard: SongRewardCard | null;
  artistCard: ArtistRewardCard | null;
}

/** 공유 카드를 카드 모양으로 바꾸고 아트 색을 입힌다. kind 에 맞는 쪽만 채워진다. */
export function useSharedCards(shared: SharedRewardCardDto): SharedCards {
  const baseSong = useMemo(() => (shared.songCard ? toSongCard(shared.songCard) : null), [shared.songCard]);
  const baseArtist = useMemo(() => (shared.artistCard ? toArtistCard(shared.artistCard) : null), [shared.artistCard]);
  const songCard = useArtColors(baseSong, baseSong?.artworkUrl);
  const artistCard = useArtColors(baseArtist, baseArtist?.imageUrl);
  return { songCard, artistCard };
}

interface ShowcaseProps extends SharedCards {
  width: number;
  ownerName: string;
}

/** 기울이고 뒤집을 수 있는 남의 카드. */
export const SharedCardShowcase = React.memo(function SharedCardShowcase({ songCard, artistCard, width, ownerName }: ShowcaseProps) {
  const fonts = useCardFonts();
  const tilt = useCardTilt();
  return (
    <GestureDetector gesture={tilt.gesture}>
      <Animated.View>
        {songCard && <SongCardShowcase card={songCard} width={width} tilt={tilt} fonts={fonts} ownerName={ownerName} />}
        {artistCard && <ArtistCardShowcase card={artistCard} width={width} tilt={tilt} fonts={fonts} ownerName={ownerName} />}
      </Animated.View>
    </GestureDetector>
  );
});

export const OwnerAvatar = React.memo(function OwnerAvatar({ name, uri, size }: { name: string; uri: string | null; size: number }) {
  const frame = { width: size, height: size, borderRadius: size / 2 };
  return uri ? (
    <Image source={{ uri }} style={frame} />
  ) : (
    <View style={[frame, styles.avatarEmpty]}>
      <Text style={[styles.avatarInitial, { fontSize: size / 2 }]}>{name.slice(0, 1)}</Text>
    </View>
  );
});

/** 공유 링크로 받은 남의 카드와 주인. */
function SharedCardStage({ shared, width }: Props) {
  const cards = useSharedCards(shared);
  const { name, profileImageUrl } = shared.owner;

  return (
    <View style={styles.root}>
      <SharedCardShowcase {...cards} width={width} ownerName={name} />
      <View style={styles.owner}>
        <OwnerAvatar name={name} uri={profileImageUrl} size={24} />
        <Text style={styles.ownerText} numberOfLines={1}>
          {name}의 카드
        </Text>
      </View>
    </View>
  );
}

export default React.memo(SharedCardStage);

export function sharedCardArtwork(shared: SharedRewardCardDto): string | null {
  return shared.songCard?.artworkUrl ?? shared.artistCard?.artworkUrl ?? null;
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 20 },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  avatarEmpty: { backgroundColor: SHOWROOM.glass, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: SHOWROOM.fg, fontWeight: '700' },
  ownerText: { color: SHOWROOM.fgDim, fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
