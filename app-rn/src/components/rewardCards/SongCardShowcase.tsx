import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import CardGlitter from './CardGlitter';
import CardWearLayer from './CardWearLayer';
import { EtchLayer, GlareLayer, HoloLayer } from './CardLayers';
import LenticularLayer from './LenticularLayer';
import LevelPips from './LevelPips';
import MasterPips from './MasterPips';
import SignatureField from './SignatureField';
import { CARD_RATIO, CardFonts, LEVEL_MATERIAL } from './cardTheme';
import { CardSignature } from './signature';
import { coatingLeft, wearAge } from './cardWear';
import { lyricKo, lyricText } from './cardLyric';
import { CardTilt } from './useCardTilt';
import { SongRewardCard } from './types';
import { verticalText } from './verticalText';

interface Props {
  card: SongRewardCard;
  width: number;
  tilt: CardTilt;
  fonts: CardFonts;
  /** 서명 없이 발급된 카드의 서명 칸에 대신 찍는 이름. 없으면 빈 칸 — 획득 화면에선 아직 서명 전이다. */
  ownerName?: string;
}

function SongCardShowcase({ card, width, tilt, fonts, ownerName }: Props) {
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
        {card.mastered ? (
          <FoilFrontFace card={card} width={width} height={height} u={u} age={age} tilt={tilt} fonts={fonts} />
        ) : (
          <FrontFace card={card} width={width} height={height} u={u} age={age} tilt={tilt} fonts={fonts} />
        )}
      </Animated.View>
      <Animated.View style={[styles.face, { borderRadius: 4.6 * u }, backStyle]}>
        <BackFace card={card} width={width} height={height} u={u} age={age} fonts={fonts} ownerName={ownerName} />
      </Animated.View>
    </View>
  );
}

export default React.memo(SongCardShowcase);

/**
 * 진열장용 앞면. 기울기를 따라가는 효과(두 장면 전환·글리터·에칭·홀로 이동)는 빼고 고정된 광택만 남긴다.
 * thumb 는 목록 썸네일 크기에서 1px 도 안 되는 디테일까지 뺀다.
 */
export const SongCardFront = React.memo(function SongCardFront({ card, width, fonts, thumb }: Omit<Props, 'tilt' | 'ownerName'> & { thumb?: boolean }) {
  const height = width * CARD_RATIO;
  const u = width / 100;
  const age = wearAge(card.recall);
  const Face = card.mastered ? FoilFrontFace : FrontFace;
  return (
    <View style={{ width, height }}>
      <Face card={card} width={width} height={height} u={u} age={age} fonts={fonts} thumb={thumb} />
    </View>
  );
});

interface SignatureSlot {
  /** 빈 서명 칸을 이 색 점선으로 표시한다. */
  signatureHint?: string;
  /** card.signature 대신 그릴 서명. 서명하는 동안 획마다 카드를 새로 만들지 않으려고 따로 받는다. */
  signature?: CardSignature | null;
}

/** 뒷면만 정적으로. 획득 연출에서 효과 없이 돌리거나 서명할 때 쓴다. */
export const SongCardBack = React.memo(function SongCardBack({
  card,
  width,
  fonts,
  ownerName,
  signatureHint,
  signature,
}: Omit<Props, 'tilt'> & SignatureSlot) {
  const height = width * CARD_RATIO;
  return (
    <View style={{ width, height }}>
      <BackFace
        card={card}
        width={width}
        height={height}
        u={width / 100}
        age={wearAge(card.recall)}
        fonts={fonts}
        ownerName={ownerName}
        signatureHint={signatureHint}
        signature={signature}
      />
    </View>
  );
});

interface FaceProps {
  card: SongRewardCard;
  width: number;
  height: number;
  u: number;
  age: number;
  fonts: CardFonts;
  thumb?: boolean;
}

function FrontFace({ card, width, height, u, age, tilt, fonts, thumb }: FaceProps & { tilt?: CardTilt }) {
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
      {/* 은색 테 위 0.2 홀로는 썸네일에선 티가 안 난다. */}
      {shiny && !(thumb && card.level === 2) && <HoloLayer tilt={tilt} width={width} height={height} opacity={(card.level === 3 ? 0.5 : 0.2) * foil} blend="overlay" />}
      {shiny && tilt && <EtchLayer tilt={tilt} width={width} height={height} opacity={foil} />}

      <View style={{ flex: 1, padding: pad, gap: 2.6 * u }}>
        <View style={[styles.art, { width: artSize, height: artSize, borderRadius: 2.4 * u }]}>
          <Image source={{ uri: card.artworkUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {card.level === 3 && !thumb && <HoloLayer tilt={tilt} width={artSize} height={artSize} opacity={0.16 * foil} blend="color-dodge" />}
          {card.level === 3 && tilt && <EtchLayer tilt={tilt} width={artSize} height={artSize} opacity={0.7 * foil} />}
          <LinearGradient
            colors={['transparent', '#08060C59', '#08060CC7']}
            locations={[0.45, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.lyricCols, { top: 5 * u, right: 4.2 * u, gap: 2.2 * u, opacity: 1 - age * 0.8 }]}>
            {card.lyric.map((line, i) => (
              <Text
                key={line.index}
                style={[
                  styles.lyricCol,
                  { fontFamily: fonts.jp, fontSize: 5.4 * u, lineHeight: 6.4 * u, marginTop: i * 7 * u },
                ]}
              >
                {verticalText(lyricText(line))}
              </Text>
            ))}
          </View>
          {card.level === 3 && tilt && <CardGlitter seed={card.id} width={artSize} height={artSize} tilt={tilt} strength={foil} />}
        </View>

        <LinearGradient
          colors={[`${card.accent}38`, `${card.ink}00`]}
          style={[styles.meta, { borderRadius: 2.4 * u, padding: 3.4 * u, backgroundColor: card.ink }]}
        >
          <Text style={[styles.title, { fontFamily: fonts.jpHeavy, fontSize: 6.8 * u, lineHeight: 8.4 * u }]} numberOfLines={1}>
            {card.title}
          </Text>
          <Text style={[styles.artist, { fontSize: 3.4 * u, color: `${card.accent}` }]} numberOfLines={1}>{card.artist}</Text>
          <View style={styles.metaFoot}>
            <OwnerMark no={card.ownerNo} u={u} fonts={fonts} />
            <LevelPips level={card.level} color={material.pip} size={2.4 * u} />
          </View>
        </LinearGradient>
      </View>

      <CardWearLayer width={width} height={height} age={age} seed={card.id} tilt={tilt} lite={thumb} />
      <GlareLayer tilt={tilt} width={width} height={height} gloss={foil} />
    </View>
  );
}

/** 마스터 카드. 테 없이 아트를 끝까지 깔고, 무지개 코팅이 두 장면 위를 함께 덮는다. */
function FoilFrontFace({ card, width, height, u, age, tilt, fonts, thumb }: FaceProps & { tilt?: CardTilt }) {
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
        {card.lyric.map((line, i) => (
          <Text
            key={line.index}
            style={[
              styles.lyricCol,
              { fontFamily: fonts.jp, fontSize: 6 * u, lineHeight: 7.2 * u, marginTop: i * 8 * u },
            ]}
          >
            {verticalText(lyricText(line))}
          </Text>
        ))}
      </View>

      <View style={[styles.foilMeta, { left: 7 * u, right: 7 * u, bottom: 7 * u, gap: 1.2 * u }]}>
        <Text style={[styles.title, { fontFamily: fonts.jpHeavy, fontSize: 8 * u, lineHeight: 10 * u }]} numberOfLines={1}>
          {card.title}
        </Text>
        <Text style={[styles.artist, { fontSize: 3.6 * u, color: card.accent }]} numberOfLines={1}>{card.artist}</Text>
        <View style={[styles.metaFoot, { marginTop: 2.4 * u }]}>
          <OwnerMark no={card.ownerNo} u={u} fonts={fonts} />
        </View>
      </View>

      {tilt ? (
        <>
          <LenticularLayer card={card} width={width} height={height} u={u} tilt={tilt} fonts={fonts} />
          <View pointerEvents="none" style={[styles.foilPips, { right: 7 * u, bottom: 7 * u }]}>
            <MasterPips level={card.level} size={2.4 * u} tilt={tilt} />
          </View>
          <EtchLayer tilt={tilt} width={width} height={height} opacity={0.55 * foil} />
          <CardGlitter seed={card.id} width={width} height={height} tilt={tilt} strength={0.7 * foil} rainbow={foil} />
        </>
      ) : (
        <>
          <HoloLayer width={width} height={height} opacity={0.3 * foil} blend="color-dodge" />
          <View pointerEvents="none" style={[styles.foilPips, { right: 7 * u, bottom: 7 * u }]}>
            <MasterPips level={card.level} size={2.4 * u} flat={thumb} />
          </View>
        </>
      )}
      <View
        pointerEvents="none"
        style={[styles.foilEdge, { top: inset, left: inset, right: inset, bottom: inset, borderRadius: 4.6 * u - inset * 0.6 }]}
      />
      <CardWearLayer width={width} height={height} age={age} seed={card.id} tilt={tilt} lite={thumb} />
      <GlareLayer tilt={tilt} width={width} height={height} gloss={foil} />
    </View>
  );
}

function OwnerMark({ no, u, fonts }: { no: number; u: number; fonts: CardFonts }) {
  return (
    <View style={styles.owner}>
      <Text style={[styles.ownerNo, { fontFamily: fonts.jpHeavy, fontSize: 6 * u, lineHeight: 7 * u }]}>
        {no.toLocaleString('ko-KR')}
      </Text>
      <Text style={[styles.ownerTail, { fontFamily: fonts.ko, fontSize: 3 * u }]}>번째 획득</Text>
    </View>
  );
}

function BackFace({
  card,
  width,
  height,
  u,
  age,
  fonts,
  ownerName,
  signatureHint,
  signature,
}: FaceProps & SignatureSlot & { ownerName?: string }) {
  const stats = [
    { label: '획득 순번', value: card.ownerNo.toLocaleString('ko-KR'), unit: '번째' },
    { label: '획득한 날', value: card.earnedAt.slice(2).replace(/-/g, '.'), unit: '' },
  ];
  return (
    <View style={[styles.clip, { borderRadius: 4.6 * u, backgroundColor: card.ink }]}>
      <LinearGradient colors={[`${card.accent}73`, `${card.ink}00`]} start={{ x: 0.1, y: 0 }} end={{ x: 0.7, y: 0.7 }} style={StyleSheet.absoluteFill} />
      <Text style={[styles.watermark, { fontFamily: fonts.jpHeavy, fontSize: 30 * u, lineHeight: 32 * u, right: -4 * u, bottom: 10 * u }]}>
        {verticalText('言の葉')}
      </Text>

      <View style={{ flex: 1, padding: 6 * u, gap: 4 * u }}>
        {/* 넘치면 이 위쪽이 잘린다 — 서명 칸은 늘 카드 안에 남아야 한다. */}
        <View style={[styles.backBody, { gap: 4 * u }]}>
          <View style={{ gap: 1.6 * u }}>
            {card.lyric.map((line) => (
              <View key={line.index} style={styles.rubyLine}>
                {line.ruby.map((seg, j) => (
                  <View key={j} style={styles.rubySeg}>
                    <Text style={[styles.rubyTop, { fontSize: 2.4 * u, lineHeight: 3.2 * u }]}>{seg.reading ?? ' '}</Text>
                    <Text style={[styles.rubyBase, { fontFamily: fonts.jp, fontSize: 5.8 * u, lineHeight: 7.4 * u }]}>{seg.text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
          <Text style={[styles.backKo, { fontFamily: fonts.ko, fontSize: 3.6 * u, lineHeight: 5.4 * u, borderLeftColor: card.accent, paddingLeft: 2.6 * u }]}>
            {lyricKo(card.lyric)}
          </Text>

          <View style={{ flex: 1, gap: 1.6 * u }}>
            {card.words.map((word) => (
              <View key={word.japanese} style={[styles.wordRow, { paddingBottom: 1.4 * u, gap: 2.4 * u }]}>
                <Text style={[styles.wordJp, { fontFamily: fonts.jp, fontSize: 4.2 * u }]}>{word.japanese}</Text>
                <Text style={[styles.wordMeaning, { fontFamily: fonts.ko, fontSize: 3.2 * u }]} numberOfLines={1}>
                  <Text style={{ fontFamily: fonts.jp }}>{word.reading}</Text> · {word.meaning}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={{ flex: 1, gap: 0.6 * u }}>
              <Text style={[styles.statLabel, { fontFamily: fonts.ko, fontSize: 2.6 * u }]}>{s.label}</Text>
              <Text style={[styles.statValue, { fontSize: 4 * u }]}>
                {s.value}
                <Text style={[styles.statUnit, { fontFamily: fonts.ko, fontSize: 2.4 * u }]}>{s.unit}</Text>
              </Text>
            </View>
          ))}
        </View>
        <SignatureField
          signature={signature === undefined ? card.signature : signature}
          fallbackName={ownerName}
          hint={signatureHint}
          u={u}
          fonts={fonts}
        />
      </View>
      <CardWearLayer width={width} height={height} age={age} seed={card.id} side="back" />
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
  art: { overflow: 'hidden', backgroundColor: '#000000' },
  lyricCols: { position: 'absolute', flexDirection: 'row-reverse', alignItems: 'flex-start' },
  lyricCol: {
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: '#000000B3',
    textShadowRadius: 8,
  },
  foilMeta: { position: 'absolute' },
  foilPips: { position: 'absolute' },
  foilEdge: { position: 'absolute', borderWidth: 1, borderColor: '#FFFFFF4D' },
  meta: { flex: 1, justifyContent: 'space-between', overflow: 'hidden' },
  title: { color: '#F6F2FA' },
  artist: { fontWeight: '500', marginTop: -2 },
  metaFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  owner: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  ownerNo: { color: '#FFFFFF' },
  ownerTail: { color: '#FFFFFFB8', fontVariant: ['tabular-nums'] },
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
  backBody: { flex: 1, minHeight: 0, overflow: 'hidden' },
  stats: { flexDirection: 'row', gap: 8 },
  statLabel: { color: '#FFFFFF8C' },
  statValue: { color: '#F2EEF7', fontWeight: '600', fontVariant: ['tabular-nums'] },
  statUnit: { color: '#FFFFFF8C' },
});
