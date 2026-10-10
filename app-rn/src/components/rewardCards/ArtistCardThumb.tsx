import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { ArtistCardFront } from './ArtistCardShowcase';
import { CardFonts } from './cardTheme';
import { ArtistRewardCard } from './types';

interface Props {
  card: ArtistRewardCard;
  width: number;
  fonts: CardFonts;
  onPress: (card: ArtistRewardCard) => void;
  onLongPress?: (card: ArtistRewardCard) => void;
}

function ArtistCardThumb({ card, width, fonts, onPress, onLongPress }: Props) {
  const handlePress = useCallback(() => onPress(card), [card, onPress]);
  const handleLongPress = useCallback(() => onLongPress?.(card), [card, onLongPress]);
  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      style={({ pressed }) => [styles.card, { borderRadius: width * 0.04 }, pressed && styles.pressed]}
    >
      <ArtistCardFront card={card} width={width} fonts={fonts} />
    </Pressable>
  );
}

export default React.memo(ArtistCardThumb);

const styles = StyleSheet.create({
  card: { boxShadow: '0 10px 18px -6px rgba(20, 12, 30, 0.45)' },
  pressed: { transform: [{ scale: 0.97 }] },
});
