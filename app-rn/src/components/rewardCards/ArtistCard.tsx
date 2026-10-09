import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ARTIST_CARD_RATIO, HOLO_COLORS, LEVEL_MATERIAL } from './cardTheme';
import { ArtistRewardCard } from './types';

interface Props {
  card: ArtistRewardCard;
  width: number;
  minchoFamily: string;
}

const TINT: Record<1 | 2 | 3, readonly [string, string, string]> = {
  1: ['#14111AF5', '#14111AB8', '#14111A66'],
  2: ['#161A24F2', '#161A2499', '#161A2440'],
  3: ['#24133AF2', '#24133A99', '#24133A40'],
};

function ArtistCard({ card, width, minchoFamily }: Props) {
  const material = LEVEL_MATERIAL[card.level];
  const progress = card.nextLevelAt ? Math.min(1, card.songCardCount / card.nextLevelAt) : 1;

  return (
    <View style={[styles.card, { width, height: width * ARTIST_CARD_RATIO }]}>
      <Image source={{ uri: card.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient colors={TINT[card.level]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={StyleSheet.absoluteFill} />
      {card.level >= 2 && (
        <LinearGradient
          colors={card.level === 3 ? HOLO_COLORS : material.frame}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, card.level === 3 ? styles.holo : styles.metal]}
        />
      )}
      <View style={[styles.edge, { borderColor: material.pip }]} />
      <View style={styles.body}>
        <View style={styles.top}>
          <LinearGradient colors={material.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.lvChip}>
            <Text style={[styles.lvText, { color: material.chipText }]}>LV.{card.level}</Text>
          </LinearGradient>
          <Text style={[styles.name, { fontFamily: minchoFamily }]} numberOfLines={1}>{card.name}</Text>
        </View>
        <View style={styles.bottom}>
          <View style={styles.countRow}>
            <Text style={styles.count}>곡 카드 {card.songCardCount}장</Text>
            {card.nextLevelAt && (
              <Text style={styles.next}>LV.{card.level + 1}까지 {card.nextLevelAt - card.songCardCount}장</Text>
            )}
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: material.pip }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

export default React.memo(ArtistCard);

const styles = StyleSheet.create({
  card: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#14111A' },
  holo: { opacity: 0.28, mixBlendMode: 'color-dodge' },
  metal: { opacity: 0.22, mixBlendMode: 'overlay' },
  edge: { ...StyleSheet.absoluteFillObject, margin: 6, borderRadius: 8, borderWidth: 1, opacity: 0.4 },
  body: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'space-between' },
  top: { gap: 6, alignItems: 'flex-start' },
  lvChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  lvText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  name: { color: '#FFFFFF', fontSize: 19, lineHeight: 24 },
  bottom: { gap: 6 },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  count: { color: '#FFFFFFD9', fontSize: 11, fontWeight: '600' },
  next: { color: '#FFFFFF99', fontSize: 10, fontWeight: '500' },
  track: { height: 4, borderRadius: 999, backgroundColor: '#FFFFFF26', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});
