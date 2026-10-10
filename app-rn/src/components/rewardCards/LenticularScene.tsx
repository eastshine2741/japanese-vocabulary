import React, { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CardFonts } from './cardTheme';
import { SongRewardCard } from './types';
import { verticalText } from './verticalText';
import { lyricKo, lyricText } from './cardLyric';

export interface LenticularProps {
  card: SongRewardCard;
  width: number;
  height: number;
  u: number;
  fonts: CardFonts;
}

/** 마스터 카드를 기울였을 때 렌티큘러 인쇄처럼 넘어가 보이는 두 번째 장면. */
const LenticularScene = forwardRef<View, LenticularProps & { onReady?: () => void }>(function LenticularScene(
  { card, width, height, u, fonts, onReady },
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
        {card.lyric.map((line, i) => (
          <Text key={line.index} style={[styles.lyricCol, { fontFamily: fonts.jpHeavy, fontSize: 9 * u, lineHeight: 10.4 * u, marginTop: i * 10 * u, textShadowColor: card.accent }]}>
            {verticalText(lyricText(line))}
          </Text>
        ))}
      </View>
      <View style={[styles.foot, { left: 7 * u, right: 7 * u, bottom: 7 * u, gap: 1.4 * u }]}>
        <Text style={[styles.ko, { fontFamily: fonts.koBold, fontSize: 3.8 * u, lineHeight: 5.4 * u }]}>{lyricKo(card.lyric)}</Text>
        <Text style={[styles.meta, { fontFamily: fonts.ko, fontSize: 2.8 * u }]}>
          <Text style={{ fontFamily: fonts.jp }}>{card.title}</Text> · {card.ownerNo.toLocaleString('ko-KR')}번째 획득
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
