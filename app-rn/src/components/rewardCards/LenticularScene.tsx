import React, { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CardFonts } from './cardTheme';
import { SongRewardCard } from './types';
import { verticalText } from './verticalText';
import { cardTitle } from './cardCredit';
import { lyricFitScale, lyricText, textFitScale } from './cardLyric';

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
  // 번역은 가사 줄마다 한 줄씩, 좌우 여백 7u 를 뺀 폭에 맞춘다.
  const koScale = textFitScale(card.lyric.map((line) => line.ko), width - 14 * u, 3.8 * u);
  // 아래 번역·곡명 묶음과 위아래 여백을 뺀 높이 안에 세로 가사를 넣는다.
  const footHeight = card.lyric.length * 5.4 * u * koScale + 1.4 * u + 4 * u;
  const lyricScale = lyricFitScale(card.lyric, height - 9 * u - 7 * u - footHeight - 10 * u, 10.4 * u, 10 * u);
  return (
    <View ref={ref} collapsable={false} style={{ width, height, backgroundColor: card.ink }}>
      <Image
        source={{ uri: card.artworkUrl }}
        style={[StyleSheet.absoluteFill, styles.art]}
        resizeMode="cover"
        onLoadEnd={onReady}
      />
      {/* mixBlendMode 는 쓰지 않는다 — iOS 캡처만 섞기를 반영해 흑백처럼 뜨고, Android 캡처는 무시한다. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: card.accent, opacity: 0.85 }]} />
      <LinearGradient colors={['#000000B0', '#00000010', '#000000D0']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.lyric, { top: 9 * u, gap: 4 * u }]}>
        {card.lyric.map((line, i) => (
          <Text key={line.index} style={[styles.lyricCol, { fontFamily: fonts.jpHeavy, fontSize: 9 * u * lyricScale, lineHeight: 10.4 * u * lyricScale, marginTop: i * 10 * u * lyricScale, textShadowColor: card.accent }]}>
            {verticalText(lyricText(line))}
          </Text>
        ))}
      </View>
      <View style={[styles.foot, { left: 7 * u, right: 7 * u, bottom: 7 * u, gap: 1.4 * u }]}>
        <View>
          {card.lyric.map((line) => (
            <Text
              key={line.index}
              style={[styles.ko, { fontFamily: fonts.koBold, fontSize: 3.8 * u * koScale, lineHeight: 5.4 * u * koScale }]}
              numberOfLines={1}
            >
              {line.ko}
            </Text>
          ))}
        </View>
        <Text style={[styles.meta, { fontFamily: fonts.ko, fontSize: 2.8 * u }]}>
          <Text style={{ fontFamily: fonts.jp }}>{cardTitle(card.title)}</Text> · {card.ownerNo.toLocaleString('ko-KR')}번째 획득
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
