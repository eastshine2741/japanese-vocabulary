import React, { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SongRewardCard } from './types';
import { verticalText } from './verticalText';

export interface LenticularProps {
  card: SongRewardCard;
  width: number;
  height: number;
  u: number;
  mincho: { bold: string; extraBold: string };
}

/** 렌티큘러 카드를 기울였을 때 넘어가 보이는 두 번째 장면. */
const LenticularScene = forwardRef<View, LenticularProps & { onReady?: () => void }>(function LenticularScene(
  { card, width, height, u, mincho, onReady },
  ref,
) {
  return (
    <View ref={ref} collapsable={false} style={{ width, height, backgroundColor: card.ink }}>
      <Image
        source={{ uri: card.artworkUrl }}
        style={[StyleSheet.absoluteFill, styles.art]}
        resizeMode="cover"
        onLoadEnd={onReady}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: card.accent, mixBlendMode: 'color', opacity: 0.85 }]} />
      <LinearGradient colors={['#000000B0', '#00000010', '#000000D0']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.lyric, { top: 9 * u, gap: 4 * u }]}>
        {card.frontLines.map((line, i) => (
          <Text key={i} style={[styles.lyricCol, { fontFamily: mincho.extraBold, fontSize: 9 * u, lineHeight: 10.4 * u, marginTop: i * 10 * u, textShadowColor: card.accent }]}>
            {verticalText(line)}
          </Text>
        ))}
      </View>
      <View style={[styles.foot, { left: 7 * u, right: 7 * u, bottom: 7 * u, gap: 1.4 * u }]}>
        <Text style={[styles.ko, { fontSize: 3.8 * u, lineHeight: 5.4 * u }]}>{card.backKo}</Text>
        <Text style={[styles.meta, { fontSize: 2.8 * u }]}>
          {card.title} · {card.ownerNo.toLocaleString('ko-KR')}번째 획득
        </Text>
      </View>
    </View>
  );
});

export default LenticularScene;

const styles = StyleSheet.create({
  art: { transform: [{ scale: 1.18 }] },
  lyric: { position: 'absolute', alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'flex-start' },
  lyricCol: { color: '#FFFFFF', textAlign: 'center', textShadowRadius: 18 },
  foot: { position: 'absolute' },
  ko: { color: '#FFFFFF' },
  meta: { color: '#FFFFFFB3' },
});
