import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import CardGlitter from './CardGlitter';
import CardWearLayer from './CardWearLayer';
import LenticularLayer from './LenticularLayer';
import LevelPips from './LevelPips';
import { CARD_RATIO, HOLO_COLORS, LEVEL_MATERIAL } from './cardTheme';
import { coatingLeft, wearAge } from './cardWear';
import { CardTilt } from './useCardTilt';
import { SongRewardCard } from './types';
import { verticalText } from './verticalText';

interface Props {
  card: SongRewardCard;
  width: number;
  tilt: CardTilt;
  mincho: { bold: string; extraBold: string };
}

function SongCardShowcase({ card, width, tilt, mincho }: Props) {
  const height = width * CARD_RATIO;
  const u = width / 100;
  const age = wearAge(card.recall);

  const frontStyle = useAnimatedStyle(() => {
    const p = tilt.pose.value;
    return {
      opacity: p.facing ? 1 : 0,
      transform: [{ perspective: 1100 }, { rotateX: `${p.rx}deg` }, { rotateY: `${p.ry}deg` }, { rotateZ: `${p.rz}deg` }],
    };
  });
  const backStyle = useAnimatedStyle(() => {
    const p = tilt.pose.value;
    return {
      opacity: p.facing ? 0 : 1,
      transform: [
        { perspective: 1100 },
        { rotateX: `${p.rx}deg` },
        { rotateY: `${p.ry}deg` },
        { rotateZ: `${p.rz}deg` },
        { rotateY: '180deg' },
      ],
    };
  });

  return (
    <View style={{ width, height }}>
      <Animated.View style={[styles.face, { borderRadius: 4.6 * u }, frontStyle]}>
        {card.lenticular ? (
          <FoilFrontFace card={card} width={width} height={height} u={u} age={age} tilt={tilt} mincho={mincho} />
        ) : (
          <FrontFace card={card} width={width} height={height} u={u} age={age} tilt={tilt} mincho={mincho} />
        )}
      </Animated.View>
      <Animated.View style={[styles.face, { borderRadius: 4.6 * u }, backStyle]}>
        <BackFace card={card} width={width} height={height} u={u} age={age} mincho={mincho} />
      </Animated.View>
    </View>
  );
}

export default React.memo(SongCardShowcase);

/** 진열장용 앞면. 기울기를 따라가는 효과(렌티큘러·글리터·에칭·홀로 이동)는 빼고 고정된 광택만 남긴다. */
export const SongCardFront = React.memo(function SongCardFront({ card, width, mincho }: Omit<Props, 'tilt'>) {
  const height = width * CARD_RATIO;
  const u = width / 100;
  const age = wearAge(card.recall);
  const Face = card.lenticular ? FoilFrontFace : FrontFace;
  return (
    <View style={{ width, height }}>
      <Face card={card} width={width} height={height} u={u} age={age} mincho={mincho} />
    </View>
  );
});

interface FaceProps {
  card: SongRewardCard;
  width: number;
  height: number;
  u: number;
  age: number;
  mincho: { bold: string; extraBold: string };
}

function FrontFace({ card, width, height, u, age, tilt, mincho }: FaceProps & { tilt?: CardTilt }) {
  const material = LEVEL_MATERIAL[card.level];
  const pad = 3.4 * u;
  const artSize = width - pad * 2;
  const shiny = card.level >= 2;
  const foil = coatingLeft(age);

  return (
    <View style={[styles.clip, { borderRadius: 4.6 * u }]}>
      <LinearGradient colors={material.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* 코팅이 벗겨지면 금속 테의 명암 띠가 사라지고 무광 단색만 남는다. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: material.frame[1], opacity: (1 - foil) * 0.8 }]} />
      {shiny && <HoloLayer tilt={tilt} width={width} height={height} opacity={(card.level === 3 ? 0.5 : 0.2) * foil} blend="overlay" />}
      {shiny && tilt && <EtchLayer tilt={tilt} width={width} height={height} opacity={foil} />}

      <View style={{ flex: 1, padding: pad, gap: 2.6 * u }}>
        <View style={[styles.art, { width: artSize, height: artSize, borderRadius: 2.4 * u }]}>
          <Image source={{ uri: card.artworkUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {card.level === 3 && <HoloLayer tilt={tilt} width={artSize} height={artSize} opacity={0.16 * foil} blend="color-dodge" />}
          {card.level === 3 && tilt && <EtchLayer tilt={tilt} width={artSize} height={artSize} opacity={0.7 * foil} />}
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
          {card.level === 3 && tilt && <CardGlitter seed={card.id} width={artSize} height={artSize} tilt={tilt} strength={foil} />}
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
              <Text style={[styles.ownerTail, { fontSize: 3 * u }]}>번째 획득</Text>
            </View>
            <LevelPips level={card.level} color={material.pip} size={2.4 * u} />
          </View>
        </LinearGradient>
      </View>

      <CardWearLayer width={width} height={height} age={age} seed={card.id} tilt={tilt} />
      <GlareLayer tilt={tilt} width={width} height={height} gloss={foil} />
    </View>
  );
}

/** 렌티큘러까지 끝낸 카드. 테 없이 아트를 끝까지 깔고, 무지개 코팅이 두 장면 위를 함께 덮는다. */
function FoilFrontFace({ card, width, height, u, age, tilt, mincho }: FaceProps & { tilt?: CardTilt }) {
  const material = LEVEL_MATERIAL[card.level];
  const foil = coatingLeft(age);
  const inset = 2.6 * u;

  return (
    <View style={[styles.clip, { borderRadius: 4.6 * u, backgroundColor: card.ink }]}>
      <Image source={{ uri: card.artworkUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={['#08060C00', '#08060C80']}
        start={{ x: 0.35, y: 0.55 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${card.ink}00`, `${card.ink}B8`, card.ink]}
        locations={[0.52, 0.76, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.lyricCols, { top: 7 * u, right: 6.4 * u, gap: 2.4 * u, opacity: 1 - age * 0.8 }]}>
        {card.frontLines.map((line, i) => (
          <Text
            key={i}
            style={[
              styles.lyricCol,
              { fontFamily: mincho.bold, fontSize: 6 * u, lineHeight: 7.2 * u, marginTop: i * 8 * u },
            ]}
          >
            {verticalText(line)}
          </Text>
        ))}
      </View>

      <View style={[styles.foilMeta, { left: 7 * u, right: 7 * u, bottom: 7 * u, gap: 1.2 * u }]}>
        <Text style={[styles.title, { fontFamily: mincho.extraBold, fontSize: 8 * u, lineHeight: 10 * u }]} numberOfLines={1}>
          {card.title}
        </Text>
        <Text style={[styles.artist, { fontSize: 3.6 * u, color: card.accent }]} numberOfLines={1}>{card.artist}</Text>
        <View style={[styles.metaFoot, { marginTop: 2.4 * u }]}>
          <View style={styles.owner}>
            <Text style={[styles.ownerNo, { fontFamily: mincho.extraBold, fontSize: 6 * u, lineHeight: 7 * u }]}>
              {card.ownerNo.toLocaleString('ko-KR')}
            </Text>
            <Text style={[styles.ownerTail, { fontSize: 3 * u }]}>번째 획득</Text>
          </View>
          <LevelPips level={card.level} color={material.pip} size={2.4 * u} />
        </View>
      </View>

      {tilt ? (
        <>
          <LenticularLayer card={card} width={width} height={height} u={u} tilt={tilt} mincho={mincho} />
          <EtchLayer tilt={tilt} width={width} height={height} opacity={0.55 * foil} />
          <CardGlitter seed={card.id} width={width} height={height} tilt={tilt} strength={0.7 * foil} rainbow={foil} />
        </>
      ) : (
        <HoloLayer width={width} height={height} opacity={0.3 * foil} blend="color-dodge" />
      )}
      <View
        pointerEvents="none"
        style={[styles.foilEdge, { top: inset, left: inset, right: inset, bottom: inset, borderRadius: 4.6 * u - inset * 0.6 }]}
      />
      <CardWearLayer width={width} height={height} age={age} seed={card.id} tilt={tilt} />
      <GlareLayer tilt={tilt} width={width} height={height} gloss={foil} />
    </View>
  );
}

function BackFace({ card, width, height, u, age, mincho }: FaceProps) {
  const stats = [
    { label: '획득 순번', value: card.ownerNo.toLocaleString('ko-KR'), unit: '번째' },
    { label: '획득한 날', value: card.earnedAt.slice(2).replace(/-/g, '.'), unit: '' },
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
      <CardWearLayer width={width} height={height} age={age} seed={card.id} side="back" />
    </View>
  );
}

function HoloLayer({ tilt, width, height, opacity, blend }: {
  tilt?: CardTilt;
  width: number;
  height: number;
  opacity: number;
  blend: 'overlay' | 'color-dodge';
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: -width + (tilt?.x.value ?? -0.2) * width * 0.8 },
      { translateY: -height * 0.5 + (tilt?.y.value ?? 0) * height * 0.35 },
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

const ETCH = require('../../../assets/cards/holo-etch.png');

/** 포일에 새긴 사선 결과 알갱이. 빛을 받는 각도에서만 떠오른다. */
function EtchLayer({ tilt, width, height, opacity }: { tilt: CardTilt; width: number; height: number; opacity: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: opacity * (0.12 + Math.min(0.88, (Math.abs(tilt.x.value) + Math.abs(tilt.y.value)) * 1.3)),
  }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.etch, style]}>
      <Image source={ETCH} resizeMode="stretch" style={{ width, height }} />
    </Animated.View>
  );
}

/** tilt 가 없으면 빛이 왼쪽 위에서 비스듬히 비친 자리에 멈춰 있다. */
function GlareLayer({ tilt, width, height, gloss }: { tilt?: CardTilt; width: number; height: number; gloss: number }) {
  const style = useAnimatedStyle(() => {
    const tx = tilt?.x.value ?? -0.35;
    const ty = tilt?.y.value ?? -0.25;
    return {
      opacity: gloss * (0.35 + Math.min(0.4, (Math.abs(tx) + Math.abs(ty)) * 0.3)),
      transform: [
        { translateX: -width * 0.75 + tx * width * 0.6 },
        { translateY: -height * 0.75 + ty * height * 0.5 },
      ],
    };
  });
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

const styles = StyleSheet.create({
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
  },
  clip: { flex: 1, overflow: 'hidden' },
  overflowHidden: { overflow: 'hidden' },
  etch: { mixBlendMode: 'color-dodge' },
  art: { overflow: 'hidden', backgroundColor: '#000000' },
  lyricCols: { position: 'absolute', flexDirection: 'row-reverse', alignItems: 'flex-start' },
  lyricCol: {
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: '#000000B3',
    textShadowRadius: 8,
  },
  foilMeta: { position: 'absolute' },
  foilEdge: { position: 'absolute', borderWidth: 1, borderColor: '#FFFFFF4D' },
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
  stats: { flexDirection: 'row', gap: 8 },
  statLabel: { color: '#FFFFFF8C' },
  statValue: { color: '#F2EEF7', fontWeight: '600', fontVariant: ['tabular-nums'] },
  statUnit: { color: '#FFFFFF8C', fontWeight: '500' },
});
