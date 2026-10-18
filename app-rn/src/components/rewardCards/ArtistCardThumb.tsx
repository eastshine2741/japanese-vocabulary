import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { ArtistCardFront } from './ArtistCardShowcase';
import CardStackEdges from './CardStackEdges';
import { CardFonts } from './cardTheme';
import { ArtistRewardCard } from './types';

interface Props {
  card: ArtistRewardCard;
  width: number;
  fonts: CardFonts;
  onPress: (card: ArtistRewardCard) => void;
  /** 같은 대상의 다른 등급 카드도 가졌다. */
  stacked?: boolean;
}

function ArtistCardThumb({ card, width, fonts, onPress, stacked = false }: Props) {
  const borderRadius = width * 0.04;
  const handlePress = useCallback(() => onPress(card), [card, onPress]);
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, { borderRadius }, pressed && styles.pressed]}
    >
      {stacked && <CardStackEdges width={width} borderRadius={borderRadius} />}
      <ArtistCardFront card={card} width={width} fonts={fonts} />
    </Pressable>
  );
}

export default React.memo(ArtistCardThumb);

const styles = StyleSheet.create({
  card: { boxShadow: '0 10px 18px -6px rgba(20, 12, 30, 0.45)' },
  pressed: { transform: [{ scale: 0.97 }] },
});
