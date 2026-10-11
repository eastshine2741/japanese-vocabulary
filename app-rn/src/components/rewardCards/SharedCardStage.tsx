import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import type { SharedRewardCardDto } from '../../types/rewardCard';
import ArtistCardShowcase from './ArtistCardShowcase';
import SongCardShowcase from './SongCardShowcase';
import { SHOWROOM, useCardFonts } from './cardTheme';
import { toArtistCard, toSongCard } from './serverRewardCards';
import { useCardTilt } from './useCardTilt';

interface Props {
  shared: SharedRewardCardDto;
  width: number;
}

/** 공유 링크로 받은 남의 카드와 주인. 앱 화면과 웹 화면이 같이 쓴다. */
function SharedCardStage({ shared, width }: Props) {
  const fonts = useCardFonts();
  const tilt = useCardTilt();
  const songCard = useMemo(() => (shared.songCard ? toSongCard(shared.songCard) : null), [shared.songCard]);
  const artistCard = useMemo(() => (shared.artistCard ? toArtistCard(shared.artistCard) : null), [shared.artistCard]);
  const { name, profileImageUrl } = shared.owner;

  return (
    <View style={styles.root}>
      <GestureDetector gesture={tilt.gesture}>
        <Animated.View>
          {songCard && <SongCardShowcase card={songCard} width={width} tilt={tilt} fonts={fonts} ownerName={name} />}
          {artistCard && <ArtistCardShowcase card={artistCard} width={width} tilt={tilt} fonts={fonts} ownerName={name} />}
        </Animated.View>
      </GestureDetector>
      <View style={styles.owner}>
        {profileImageUrl ? (
          <Image source={{ uri: profileImageUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.avatarInitial}>{name.slice(0, 1)}</Text>
          </View>
        )}
        <Text style={styles.ownerText} numberOfLines={1}>
          {name}의 카드
        </Text>
      </View>
    </View>
  );
}

export default React.memo(SharedCardStage);

export function sharedCardTitle(shared: SharedRewardCardDto): string {
  return shared.songCard?.title ?? shared.artistCard?.name ?? '';
}

export function sharedCardArtwork(shared: SharedRewardCardDto): string | null {
  return shared.songCard?.artworkUrl ?? shared.artistCard?.artworkUrl ?? null;
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 20 },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  avatarEmpty: { backgroundColor: SHOWROOM.glass, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: SHOWROOM.fg, fontSize: 12, fontWeight: '700' },
  ownerText: { color: SHOWROOM.fgDim, fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
