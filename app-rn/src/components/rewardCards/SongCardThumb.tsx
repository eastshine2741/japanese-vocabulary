import React, { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CardWearLayer from './CardWearLayer';
import LevelPips from './LevelPips';
import { CARD_RATIO, HOLO_COLORS, LEVEL_MATERIAL } from './cardTheme';
import { wearAge } from './cardWear';
import { SongRewardCard } from './types';

interface Props {
  card: SongRewardCard;
  width: number;
  minchoFamily: string;
  onPress: (card: SongRewardCard) => void;
}

const FRAME = 3;

function SongCardThumb({ card, width, minchoFamily, onPress }: Props) {
  const handlePress = useCallback(() => onPress(card), [card, onPress]);
  const material = LEVEL_MATERIAL[card.level];
  const height = width * CARD_RATIO;
  const artW = width - FRAME * 2;
  const artH = height - FRAME * 2;

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [pressed && styles.pressed]}>
      <LinearGradient
        colors={material.frame}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.frame, { width, height }]}
      >
        <View style={[styles.art, { width: artW, height: artH }]}>
          <Image source={{ uri: card.artworkUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {card.lenticular && (
            <LinearGradient
              colors={HOLO_COLORS}
              start={{ x: 0, y: 0.1 }}
              end={{ x: 1, y: 0.9 }}
              style={[StyleSheet.absoluteFill, styles.holo]}
            />
          )}
          <LinearGradient
            colors={['transparent', 'transparent', '#000000B0', '#000000EE']}
            locations={[0, 0.45, 0.78, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.meta}>
            <Text style={[styles.title, { fontFamily: minchoFamily }]} numberOfLines={1}>{card.title}</Text>
            <LevelPips level={card.level} color={material.pip} size={5} />
          </View>
          <CardWearLayer width={artW} height={artH} age={wearAge(card.recall)} seed={card.id} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export default React.memo(SongCardThumb);

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.97 }] },
  frame: { borderRadius: 8, padding: FRAME },
  art: { borderRadius: 6, overflow: 'hidden', backgroundColor: '#1A1820', justifyContent: 'flex-end' },
  holo: { opacity: 0.45, mixBlendMode: 'color-dodge' },
  meta: { paddingHorizontal: 8, paddingBottom: 8, gap: 5 },
  title: { color: '#FFFFFF', fontSize: 12.5, lineHeight: 16 },
});
