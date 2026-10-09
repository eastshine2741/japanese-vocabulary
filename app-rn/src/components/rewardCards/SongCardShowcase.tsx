import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { SharedValue, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';
import CardWearLayer from './CardWearLayer';
import LevelPips from './LevelPips';
import { CARD_RATIO, HOLO_COLORS, LEVEL_MATERIAL, seededRandom } from './cardTheme';
import { wearAge } from './cardWear';
import { CardTilt } from './useCardTilt';
import { SongRewardCard } from './types';

interface Props {
  card: SongRewardCard;
  width: number;
  tilt: CardTilt;
  mincho: { bold: string; extraBold: string };
}

const MAX_ROTATE_X = 12;
const MAX_ROTATE_Y = 16;
const LENTI_STRIPS = 22;

const verticalText = (line: string) => [...line.replace(/ー/g, '丨')].join('\n');

function SongCardShowcase({ card, width, tilt, mincho }: Props) {
  const height = width * CARD_RATIO;
  const u = width / 100;
  const age = wearAge(card.recall);

  const frontStyle = useAnimatedStyle(() => ({
    opacity: tilt.flip.value < 0.5 ? 1 : 0,
    transform: [
      { perspective: 1100 },
      { rotateX: `${-tilt.y.value * MAX_ROTATE_X}deg` },
      { rotateY: `${tilt.x.value * MAX_ROTATE_Y + tilt.flip.value * 180}deg` },
    ],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: tilt.flip.value < 0.5 ? 0 : 1,
    transform: [
      { perspective: 1100 },
      { rotateX: `${-tilt.y.value * MAX_ROTATE_X}deg` },
      { rotateY: `${tilt.x.value * MAX_ROTATE_Y + tilt.flip.value * 180 + 180}deg` },
    ],
  }));

  return (
    <View style={{ width, height }}>
      <Animated.View style={[styles.face, { borderRadius: 4.6 * u }, frontStyle]}>
        <FrontFace card={card} width={width} height={height} u={u} age={age} tilt={tilt} mincho={mincho} />
      </Animated.View>
      <Animated.View style={[styles.face, { borderRadius: 4.6 * u }, backStyle]}>
        <BackFace card={card} width={width} height={height} u={u} age={age} mincho={mincho} />
      </Animated.View>
    </View>
  );
}

export default React.memo(SongCardShowcase);

interface FaceProps {
  card: SongRewardCard;
  width: number;
  height: number;
  u: number;
  age: number;
  mincho: { bold: string; extraBold: string };
}

function FrontFace({ card, width, height, u, age, tilt, mincho }: FaceProps & { tilt: CardTilt }) {
  const material = LEVEL_MATERIAL[card.level];
  const pad = 3.4 * u;
  const artSize = width - pad * 2;
  const shiny = card.level >= 2;
  // 기억이 흐려질수록 포일도 같이 죽는다.
  const foil = Math.pow(1 - age, 1.6);

  return (
    <View style={[styles.clip, { borderRadius: 4.6 * u }]}>
      <LinearGradient colors={material.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {shiny && <HoloLayer tilt={tilt} width={width} height={height} opacity={0.5 * foil} blend="overlay" />}

      <View style={{ flex: 1, padding: pad, gap: 2.6 * u }}>
        <View style={[styles.art, { width: artSize, height: artSize, borderRadius: 2.4 * u }]}>
          <Image source={{ uri: card.artworkUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {card.level === 3 && <HoloLayer tilt={tilt} width={artSize} height={artSize} opacity={0.38 * foil} blend="color-dodge" />}
          <LinearGradient
            colors={['transparent', '#08060C59', '#08060CC7']}
            locations={[0.45, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.lyricCols, { top: 5 * u, right: 4.2 * u, gap: 2.2 * u, opacity: 1 - age * 0.8 }]}>
            {card.frontLines.map((line, i) => (
              <Text
                key={i}
                style={[
                  styles.lyricCol,
                  { fontFamily: mincho.bold, fontSize: 5.4 * u, lineHeight: 6.4 * u, marginTop: i * 7 * u },
                ]}
              >
                {verticalText(line)}
              </Text>
            ))}
          </View>
          {card.level === 3 && <SparkleLayer seed={card.id} size={artSize} tilt={tilt} opacity={foil} />}
        </View>

        <LinearGradient
          colors={[`${card.accent}38`, `${card.ink}00`]}
          style={[styles.meta, { borderRadius: 2.4 * u, padding: 3.4 * u, backgroundColor: card.ink }]}
        >
          <Text style={[styles.title, { fontFamily: mincho.extraBold, fontSize: 6.8 * u, lineHeight: 8.4 * u }]} numberOfLines={1}>
            {card.title}
          </Text>
          <Text style={[styles.artist, { fontSize: 3.4 * u, color: `${card.accent}` }]} numberOfLines={1}>{card.artist}</Text>
          <View style={styles.metaFoot}>
            <View style={styles.owner}>
              <Text style={[styles.ownerNo, { fontFamily: mincho.extraBold, fontSize: 6 * u, lineHeight: 7 * u }]}>
                {card.ownerNo.toLocaleString('ko-KR')}
              </Text>
              <Text style={[styles.ownerTail, { fontSize: 3 * u }]}>번째 소장</Text>
            </View>
            <LevelPips level={card.level} color={material.pip} size={2.4 * u} />
          </View>
        </LinearGradient>
      </View>

      {card.lenticular && <LenticularLayer card={card} width={width} height={height} u={u} tilt={tilt} mincho={mincho} />}
      <CardWearLayer width={width} height={height} age={age} seed={card.id} />
      <GlareLayer tilt={tilt} width={width} height={height} />
    </View>
  );
}

function BackFace({ card, width, height, u, age, mincho }: FaceProps) {
  const stats = [
    { label: '소장 순번', value: card.ownerNo.toLocaleString('ko-KR'), unit: `/${card.ownerTotal.toLocaleString('ko-KR')}` },
    { label: '장기기억', value: String(card.longTermCount), unit: `/${card.totalWords}` },
    { label: '손에 넣은 날', value: card.earnedAt.slice(2).replace(/-/g, '.'), unit: '' },
  ];
  return (
    <View style={[styles.clip, { borderRadius: 4.6 * u, backgroundColor: card.ink }]}>
      <LinearGradient colors={[`${card.accent}73`, `${card.ink}00`]} start={{ x: 0.1, y: 0 }} end={{ x: 0.7, y: 0.7 }} style={StyleSheet.absoluteFill} />
      <Text style={[styles.watermark, { fontFamily: mincho.extraBold, fontSize: 30 * u, lineHeight: 32 * u, right: -4 * u, bottom: 10 * u }]}>
        {verticalText('言の葉')}
      </Text>

      <View style={{ flex: 1, padding: 6 * u, gap: 4 * u }}>
        <View style={{ gap: 1.6 * u }}>
          {card.backLines.map((line, i) => (
            <View key={i} style={styles.rubyLine}>
              {line.map((seg, j) => (
                <View key={j} style={styles.rubySeg}>
                  <Text style={[styles.rubyTop, { fontSize: 2.4 * u, lineHeight: 3.2 * u }]}>{seg.reading ?? ' '}</Text>
                  <Text style={[styles.rubyBase, { fontFamily: mincho.bold, fontSize: 5.8 * u, lineHeight: 7.4 * u }]}>{seg.text}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
        <Text style={[styles.backKo, { fontSize: 3.6 * u, lineHeight: 5.4 * u, borderLeftColor: card.accent, paddingLeft: 2.6 * u }]}>
          {card.backKo}
        </Text>

        <View style={{ flex: 1, gap: 1.6 * u }}>
          {card.words.map((word) => (
            <View key={word.japanese} style={[styles.wordRow, { paddingBottom: 1.4 * u, gap: 2.4 * u }]}>
              <Text style={[styles.wordJp, { fontFamily: mincho.bold, fontSize: 4.2 * u }]}>{word.japanese}</Text>
              <Text style={[styles.wordMeaning, { fontSize: 3.2 * u }]} numberOfLines={1}>
                {word.reading} · {word.meaning}
              </Text>
              <Text style={[styles.wordJlpt, { fontSize: 2.6 * u }]}>{word.jlpt ?? '—'}</Text>
            </View>
          ))}
        </View>

        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={{ flex: 1, gap: 0.6 * u }}>
              <Text style={[styles.statLabel, { fontSize: 2.6 * u }]}>{s.label}</Text>
              <Text style={[styles.statValue, { fontSize: 4 * u }]}>
                {s.value}
                <Text style={[styles.statUnit, { fontSize: 2.4 * u }]}>{s.unit}</Text>
              </Text>
            </View>
          ))}
        </View>
      </View>
      <CardWearLayer width={width} height={height} age={age * 0.7} seed={`${card.id}-back`} />
    </View>
  );
}

function HoloLayer({ tilt, width, height, opacity, blend }: {
  tilt: CardTilt;
  width: number;
  height: number;
  opacity: number;
  blend: 'overlay' | 'color-dodge';
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: -width + tilt.x.value * width * 0.8 },
      { translateY: -height * 0.5 + tilt.y.value * height * 0.35 },
    ],
  }));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overflowHidden, { opacity, mixBlendMode: blend }]}>
      <Animated.View style={[{ width: width * 3, height: height * 2 }, style]}>
        <LinearGradient colors={HOLO_COLORS} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

function GlareLayer({ tilt, width, height }: { tilt: CardTilt; width: number; height: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + Math.min(0.4, (Math.abs(tilt.x.value) + Math.abs(tilt.y.value)) * 0.3),
    transform: [
      { translateX: -width * 0.75 + tilt.x.value * width * 0.6 },
      { translateY: -height * 0.75 + tilt.y.value * height * 0.5 },
    ],
  }));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overflowHidden]}>
      <Animated.View style={[{ width: width * 2.5, height: height * 2.5 }, style]}>
        <LinearGradient
          colors={['#FFFFFF00', '#FFFFFF00', '#FFFFFF55', '#FFFFFF00', '#00000033']}
          locations={[0, 0.38, 0.5, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function SparkleLayer({ seed, size, tilt, opacity }: { seed: string; size: number; tilt: CardTilt; opacity: number }) {
  const stars = useMemo(() => {
    const rnd = seededRandom(`${seed}-spark`);
    return Array.from({ length: 34 }, () => {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 0.6 + rnd() * 2.2;
      return { d: `M${x} ${y - r * 2}L${x + r * 0.4} ${y - r * 0.4}L${x + r * 2} ${y}L${x + r * 0.4} ${y + r * 0.4}L${x} ${y + r * 2}L${x - r * 0.4} ${y + r * 0.4}L${x - r * 2} ${y}L${x - r * 0.4} ${y - r * 0.4}Z`, o: 0.4 + rnd() * 0.6 };
    });
  }, [seed, size]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity * (0.25 + Math.min(0.75, (Math.abs(tilt.x.value) + Math.abs(tilt.y.value)) * 0.9)),
    transform: [{ translateX: tilt.x.value * 6 }, { translateY: tilt.y.value * 6 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={size} height={size}>
        {stars.map((s, i) => <Path key={i} d={s.d} fill="#FFFBE8" fillOpacity={s.o} />)}
      </Svg>
    </Animated.View>
  );
}

function LenticularLayer({ card, width, height, u, tilt, mincho }: {
  card: SongRewardCard;
  width: number;
  height: number;
  u: number;
  tilt: CardTilt;
  mincho: { bold: string; extraBold: string };
}) {
  const stripW = width / LENTI_STRIPS;
  const scene = (
    <View style={{ width, height, backgroundColor: card.ink }}>
      <Image source={{ uri: card.artworkUrl }} style={[StyleSheet.absoluteFill, styles.sceneArt]} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: card.accent, mixBlendMode: 'color', opacity: 0.85 }]} />
      <LinearGradient colors={['#000000B0', '#00000010', '#000000D0']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.sceneLyric, { top: 9 * u, gap: 4 * u }]}>
        {card.frontLines.map((line, i) => (
          <Text key={i} style={[styles.sceneLyricCol, { fontFamily: mincho.extraBold, fontSize: 9 * u, lineHeight: 10.4 * u, marginTop: i * 10 * u, textShadowColor: card.accent }]}>
            {verticalText(line)}
          </Text>
        ))}
      </View>
      <View style={[styles.sceneFoot, { left: 7 * u, right: 7 * u, bottom: 7 * u, gap: 1.4 * u }]}>
        <Text style={[styles.sceneKo, { fontSize: 3.8 * u, lineHeight: 5.4 * u }]}>{card.backKo}</Text>
        <Text style={[styles.sceneMeta, { fontSize: 2.8 * u }]}>
          {card.title} · {card.ownerNo.toLocaleString('ko-KR')}번째 소장
        </Text>
      </View>
    </View>
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: LENTI_STRIPS }, (_, i) => (
        <LentiStrip key={i} index={i} stripW={stripW} height={height} x={tilt.x}>
          {scene}
        </LentiStrip>
      ))}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {Array.from({ length: LENTI_STRIPS * 2 }, (_, i) => (
          <Line
            key={i}
            x1={(i * stripW) / 2}
            y1={0}
            x2={(i * stripW) / 2}
            y2={height}
            stroke={i % 2 ? '#000000' : '#FFFFFF'}
            strokeOpacity={i % 2 ? 0.1 : 0.14}
            strokeWidth={0.6}
          />
        ))}
      </Svg>
    </View>
  );
}

const LentiStrip = React.memo(function LentiStrip({ index, stripW, height, x, children }: {
  index: number;
  stripW: number;
  height: number;
  x: SharedValue<number>;
  children: React.ReactNode;
}) {
  // 줄마다 넘어가는 각도가 조금씩 달라서, 기울이면 장면이 왼쪽부터 쓸려 바뀐다.
  const start = 0.05 + (index / LENTI_STRIPS) * 0.3;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [start, start + 0.16], [0, 1], 'clamp'),
  }));
  return (
    <Animated.View style={[styles.strip, { left: index * stripW, width: Math.ceil(stripW), height }, style]}>
      <View style={{ position: 'absolute', left: -index * stripW }}>{children}</View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
  },
  clip: { flex: 1, overflow: 'hidden' },
  overflowHidden: { overflow: 'hidden' },
  art: { overflow: 'hidden', backgroundColor: '#000000' },
  lyricCols: { position: 'absolute', flexDirection: 'row-reverse', alignItems: 'flex-start' },
  lyricCol: {
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: '#000000B3',
    textShadowRadius: 8,
  },
  meta: { flex: 1, justifyContent: 'space-between', overflow: 'hidden' },
  title: { color: '#F6F2FA' },
  artist: { fontWeight: '500', marginTop: -2 },
  metaFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  owner: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  ownerNo: { color: '#FFFFFF' },
  ownerTail: { color: '#FFFFFFB8' },
  watermark: { position: 'absolute', color: '#FFFFFF0D', textAlign: 'center' },
  rubyLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  rubySeg: { alignItems: 'center' },
  rubyTop: { color: '#FFFFFFB3' },
  rubyBase: { color: '#F2EEF7' },
  backKo: { color: '#FFFFFFC7', borderLeftWidth: 2 },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FFFFFF24',
  },
  wordJp: { color: '#F2EEF7' },
  wordMeaning: { flex: 1, color: '#FFFFFFB3' },
  wordJlpt: { color: '#FFFFFF8C', fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', gap: 8 },
  statLabel: { color: '#FFFFFF8C' },
  statValue: { color: '#F2EEF7', fontWeight: '600', fontVariant: ['tabular-nums'] },
  statUnit: { color: '#FFFFFF8C', fontWeight: '500' },
  strip: { position: 'absolute', top: 0, overflow: 'hidden' },
  sceneArt: { transform: [{ scale: 1.18 }] },
  sceneLyric: { position: 'absolute', alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'flex-start' },
  sceneLyricCol: { color: '#FFFFFF', textAlign: 'center', textShadowRadius: 18 },
  sceneFoot: { position: 'absolute' },
  sceneKo: { color: '#FFFFFF' },
  sceneMeta: { color: '#FFFFFFB3' },
});
