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

// 앨범아트는 앞면보다 당겨 잡아, 넘어가도 같은 그림의 다른 장면처럼 보이게 한다.
export const LENTICULAR_ART_SCALE = 1.18;

/** 두 번째 장면의 글씨만. 배경이 비어 있어 앱은 이것만 떠서 셰이더가 칠한 아트 위에 얹는다. */
export const LenticularText = forwardRef<View, LenticularProps & { onLayout?: () => void }>(function LenticularText(
  { card, width, height, u, fonts, onLayout },
  ref,
) {
  // 번역은 가사 줄마다 한 줄씩, 좌우 여백 7u 를 뺀 폭에 맞춘다.
  const koScale = textFitScale(card.lyric.map((line) => line.ko), width - 14 * u, 3.8 * u);
  // 아래 번역·곡명 묶음과 위아래 여백을 뺀 높이 안에 세로 가사를 넣는다.
  const footHeight = card.lyric.length * 5.4 * u * koScale + 1.4 * u + 4 * u;
  const lyricScale = lyricFitScale(card.lyric, height - 9 * u - 7 * u - footHeight - 10 * u, 10.4 * u, 10 * u);
  return (
    <View ref={ref} collapsable={false} style={{ width, height }} onLayout={onLayout}>
      <View style={[styles.lyric, { top: 9 * u, gap: 4 * u }]}>
        {card.lyric.map((line, i) => (
          <Text key={line.index} style={[styles.lyricCol, { fontFamily: fonts.jpHeavy, fontSize: 9 * u * lyricScale, lineHeight: 10.4 * u * lyricScale, marginTop: i * 10 * u * lyricScale, textShadowColor: card.ink }]}>
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
          <Text style={{ fontFamily: fonts.jp }}>{cardTitle(card.title)}</Text> · {card.sample ? '—' : card.ownerNo.toLocaleString('ko-KR')}번째 획득
        </Text>
      </View>
    </View>
  );
});

/** 웹(개발용) 장면. 앱은 아트를 셰이더로 두 색 인쇄처럼 칠하고, 웹은 블렌드로 흉내만 낸다. */
export default function LenticularScene(props: LenticularProps) {
  const { card } = props;
  return (
    <View style={{ width: props.width, height: props.height, backgroundColor: card.ink }}>
      <Image source={{ uri: card.artworkUrl }} style={[StyleSheet.absoluteFill, styles.art]} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: card.accent, mixBlendMode: 'color' }]} />
      <LinearGradient colors={[`${card.ink}A6`, `${card.ink}30`, `${card.ink}E6`]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={StyleSheet.absoluteFill}>
        <LenticularText {...props} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  art: { transform: [{ scale: LENTICULAR_ART_SCALE }] },
  lyric: { position: 'absolute', alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'flex-start' },
  lyricCol: { color: '#FFFFFF', textAlign: 'center', textShadowRadius: 18 },
  foot: { position: 'absolute' },
  ko: { color: '#FFFFFF' },
  meta: { color: '#FFFFFFB3' },
});
