import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SongCardKindGrid } from '../rewardCards/CardKindGrid';
import { useShallow } from 'zustand/react/shallow';
import { songCardsOf } from '../rewardCards/cardKinds';
import type { PreviewSong } from '../rewardCards/cardPreview';
import { useCardFonts } from '../rewardCards/cardTheme';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import type { SongWordTierDto } from '../../types/song';

const PAGE_PADDING = 20;
const EMPTY_TIERS: readonly SongWordTierDto[] = [];

export const SongDetailCardsTab = React.memo(function SongDetailCardsTab({
  song,
  tiers,
}: {
  song: PreviewSong;
  /** 단계 이름을 조건에 쓴다. 못 받았으면 빈 이름으로 둔다. */
  tiers: readonly SongWordTierDto[] | null;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const fonts = useCardFonts();
  const cards = useRewardCardStore(useShallow(s => songCardsOf(s.songCards, song.id, song.title)));
  useEffect(() => {
    useRewardCardStore.getState().ensureServerCards();
  }, []);
  return (
    <View style={styles.container}>
      <SongCardKindGrid
        song={song}
        cards={cards}
        tiers={tiers ?? EMPTY_TIERS}
        width={screenWidth - PAGE_PADDING * 2}
        fonts={fonts}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 120,
  },
});
