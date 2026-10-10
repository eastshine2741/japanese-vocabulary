import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SongCardFront } from './SongCardShowcase';
import { CardFonts } from './cardTheme';
import { SongRewardCard } from './types';

interface Props {
  card: SongRewardCard;
  width: number;
  fonts: CardFonts;
  onPress: (card: SongRewardCard) => void;
  onLongPress?: (card: SongRewardCard) => void;
}

function SongCardThumb({ card, width, fonts, onPress, onLongPress }: Props) {
  const handlePress = useCallback(() => onPress(card), [card, onPress]);
  const handleLongPress = useCallback(() => onLongPress?.(card), [card, onLongPress]);
  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      style={({ pressed }) => [styles.card, { borderRadius: width * 0.046 }, pressed && styles.pressed]}
    >
      <SongCardFront card={card} width={width} fonts={fonts} thumb />
    </Pressable>
  );
}

export default React.memo(SongCardThumb);

const styles = StyleSheet.create({
  card: { boxShadow: '0 10px 18px -6px rgba(20, 12, 30, 0.45)' },
  pressed: { transform: [{ scale: 0.97 }] },
});
