import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import CardGlitter from './CardGlitter';
import { EtchLayer, GlareLayer, HoloLayer } from './CardLayers';
import OwnerField from './OwnerField';
import { artistGradeStep } from './artistGrade';
import { ARTIST_CARD_RATIO, ARTIST_MATERIAL, CardFonts } from './cardTheme';
import { CardTilt } from './useCardTilt';
import { ArtistRewardCard } from './types';

interface Props {
  card: ArtistRewardCard;
  width: number;
  tilt: CardTilt;
  fonts: CardFonts;
  /** 카드 주인의 표시 이름. 뒷면 소유자 칸에 적힌다. */
  ownerName: string;
}

const PAPER = require('../../../assets/cards/paper-fiber.png');

function ArtistCardShowcase({ card, width, tilt, fonts, ownerName }: Props) {
  const height = width * ARTIST_CARD_RATIO;
  const u = width / 100;

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
      <Animated.View style={[styles.face, { borderRadius: 4 * u }, frontStyle]}>
        <FrontFace card={card} width={width} height={height} u={u} tilt={tilt} fonts={fonts} />
      </Animated.View>
      <Animated.View style={[styles.face, { borderRadius: 4 * u }, backStyle]}>
        <BackFace card={card} width={width} height={height} u={u} fonts={fonts} ownerName={ownerName} />
      </Animated.View>
    </View>
  );
}

export default React.memo(ArtistCardShowcase);

/** 진열장용 앞면. 기울기를 따라가는 효과는 빼고 고정된 광택만 남긴다. */
export const ArtistCardFront = React.memo(function ArtistCardFront({ card, width, fonts }: Omit<Props, 'tilt' | 'ownerName'>) {
  const height = width * ARTIST_CARD_RATIO;
  return (
    <View style={{ width, height }}>
      <FrontFace card={card} width={width} height={height} u={width / 100} fonts={fonts} />
    </View>
  );
});

interface FaceProps {
  card: ArtistRewardCard;
  width: number;
  height: number;
  u: number;
  fonts: CardFonts;
}

function FrontFace({ card, width, height, u, tilt, fonts }: FaceProps & { tilt?: CardTilt }) {
  const grade = artistGradeStep(card.masteredCount).grade;
  const m = ARTIST_MATERIAL[grade];
  const pad = m.fullBleed ? 0 : 2.8 * u;
  const winW = width - pad * 2;
  const winH = height - pad * 2;
  // 금은 사진 안에서만 반짝이고, 플래티넘·다이아는 테까지 카드 전체가 반짝인다.
  const glitterOnArt = grade === 'gold';

  return (
    <View style={[styles.clip, { borderRadius: 4 * u, backgroundColor: card.ink }]}>
      {!m.fullBleed && (
        <LinearGradient colors={m.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {grade === 'paper' && <Image source={PAPER} style={[StyleSheet.absoluteFill, styles.paper]} resizeMode="repeat" />}
      {m.frameHolo > 0 && <HoloLayer tilt={tilt} width={width} height={height} opacity={m.frameHolo} blend="overlay" />}
      {m.etch > 0 && tilt && !m.fullBleed && <EtchLayer tilt={tilt} width={width} height={height} opacity={m.etch} />}

      <View style={[styles.window, { left: pad, top: pad, width: winW, height: winH, borderRadius: m.fullBleed ? 0 : 2.2 * u }]}>
        <Image source={{ uri: card.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {m.artHolo > 0 && <HoloLayer tilt={tilt} width={winW} height={winH} opacity={m.artHolo} blend="color-dodge" />}
        <LinearGradient
          colors={[`${card.ink}E6`, `${card.ink}80`, `${card.ink}00`]}
          locations={[0, 0.45, 0.85]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0.75, y: 0.2 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient colors={['#00000066', '#00000000']} locations={[0, 0.35]} style={StyleSheet.absoluteFill} />
        {glitterOnArt && tilt && <CardGlitter seed={card.id} width={winW} height={winH} tilt={tilt} strength={m.glitter} />}

        <View style={[styles.content, { padding: (m.fullBleed ? 6 : 4) * u }]}>
          <View style={styles.topRow}>
            <Text style={[styles.fanNo, { fontFamily: fonts.jpHeavy, fontSize: 4.2 * u }]}>
              {card.fanNo.toLocaleString('ko-KR')}
              <Text style={[styles.fanTail, { fontFamily: fonts.ko, fontSize: 2.6 * u }]}>번째 팬</Text>
            </Text>
            <Text style={[styles.since, { fontSize: 2.6 * u }]}>SINCE {card.since.slice(0, 7).replace('-', '.')}</Text>
          </View>
          <Text
            style={[styles.name, { fontFamily: fonts.jpHeavy, fontSize: 8.4 * u, lineHeight: 10.4 * u }]}
            numberOfLines={2}
          >
            {card.name}
          </Text>
        </View>
      </View>

      {!glitterOnArt && m.glitter > 0 && tilt && (
        <CardGlitter seed={card.id} width={width} height={height} tilt={tilt} strength={0.7 * m.glitter} rainbow={m.rainbow} />
      )}
      {m.rainbow > 0 && !tilt && <HoloLayer width={width} height={height} opacity={0.3 * m.rainbow} blend="color-dodge" />}
      {m.fullBleed && tilt && <EtchLayer tilt={tilt} width={width} height={height} opacity={m.etch} />}
      {m.fullBleed && (
        <View pointerEvents="none" style={[styles.foilEdge, { margin: 2.4 * u, borderRadius: 2.6 * u }]} />
      )}
      <GlareLayer tilt={tilt} width={width} height={height} gloss={m.gloss} />
    </View>
  );
}

// 앞면은 팬 정보, 뒷면은 마스터 기록만 담는다.
function BackFace({ card, u, fonts, ownerName }: FaceProps & { ownerName: string }) {
  const m = ARTIST_MATERIAL[artistGradeStep(card.masteredCount).grade];
  const rest = card.masteredCount - card.recentMastered.length;

  return (
    <View style={[styles.clip, { borderRadius: 4 * u, backgroundColor: card.ink }]}>
      <LinearGradient colors={[`${card.accent}66`, `${card.ink}00`]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.8 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={m.frame}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.backStripe, { height: 1.2 * u }]}
      />
      <Text style={[styles.watermark, { fontFamily: fonts.jpHeavy, fontSize: 22 * u, right: -2 * u, bottom: -5 * u }]}>
        言の葉
      </Text>

      <View style={[styles.backBody, { padding: 5.4 * u, gap: 5 * u }]}>
        <View style={styles.backLeft}>
          <View>
            <Text style={[styles.label, { fontFamily: fonts.koBold, fontSize: 2.6 * u, letterSpacing: 0.3 * u }]}>MASTER</Text>
            <Text style={[styles.countValue, { fontFamily: fonts.jpHeavy, fontSize: 16 * u, lineHeight: 18 * u }]}>
              {card.masteredCount}
              <Text style={[styles.countUnit, { fontSize: 5 * u }]}>曲</Text>
            </Text>
          </View>
          <OwnerField name={ownerName} u={u} fonts={fonts} />
        </View>

        {card.recentMastered.length > 0 && (
          <View style={[styles.backRight, { gap: 1 * u }]}>
            <Text style={[styles.label, { fontFamily: fonts.ko, fontSize: 2.6 * u }]}>마스터한 곡</Text>
            {card.recentMastered.map((song) => (
              <View key={song.title} style={[styles.songRow, { paddingBottom: 1 * u, gap: 2 * u }]}>
                <Image source={{ uri: song.artworkUrl }} style={[styles.cover, { width: 6 * u, height: 6 * u, borderRadius: 0.8 * u }]} />
                <Text style={[styles.songTitle, { fontFamily: fonts.jp, fontSize: 3.4 * u }]} numberOfLines={1}>
                  {song.title}
                </Text>
              </View>
            ))}
            {rest > 0 && <Text style={[styles.more, { fontFamily: fonts.ko, fontSize: 2.8 * u }]}>외 {rest}곡</Text>}
          </View>
        )}
      </View>
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
  paper: { opacity: 0.55 },
  window: { position: 'absolute', overflow: 'hidden', backgroundColor: '#000000' },
  content: { flex: 1, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  fanNo: { color: '#FFFFFF' },
  fanTail: { color: '#FFFFFFB8', fontVariant: ['tabular-nums'] },
  since: { color: '#FFFFFFB8', fontWeight: '600', letterSpacing: 1 },
  name: { color: '#FFFFFF', textShadowColor: '#00000080', textShadowRadius: 12 },
  foilEdge: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: '#FFFFFF4D' },
  backStripe: { position: 'absolute', top: 0, left: 0, right: 0 },
  watermark: { position: 'absolute', color: '#FFFFFF0D' },
  backBody: { flex: 1, flexDirection: 'row' },
  backLeft: { flex: 1, justifyContent: 'space-between' },
  backRight: { flex: 1.3 },
  countValue: { color: '#F2EEF7', fontVariant: ['tabular-nums'] },
  countUnit: { color: '#FFFFFF8C' },
  label: { color: '#FFFFFF8C' },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FFFFFF24',
  },
  cover: { backgroundColor: '#FFFFFF14', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF33' },
  songTitle: { flex: 1, color: '#F2EEF7' },
  more: { color: '#FFFFFF8C' },
});
