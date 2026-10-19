import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SongCardKindGrid } from '../rewardCards/CardKindGrid';
import { useShallow } from 'zustand/react/shallow';
import { songCardsOf } from '../rewardCards/cardKinds';
import type { PreviewSong } from '../rewardCards/cardPreview';
import { useCardFonts } from '../rewardCards/cardTheme';
import { useRewardCardStore } from '../../stores/rewardCardStore';

const PAGE_PADDING = 20;

export const SongDetailCardsTab = React.memo(function SongDetailCardsTab({
  song,
}: {
  song: PreviewSong;
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
