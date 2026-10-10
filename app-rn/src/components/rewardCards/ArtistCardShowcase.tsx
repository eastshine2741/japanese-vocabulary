import React, { useEffect, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import CardGlitter from './CardGlitter';
import { FacetLayer, GlareLayer, HoloLayer, StaticSparkles } from './CardLayers';
import { GuillocheLayer, RimLayer, RosetteLayer } from './ArtistFoil';
import ArtistPhoto from './ArtistPhoto';
import FoilText from './FoilText';
import SignatureField from './SignatureField';
import { ArtistGrade, artistGradeStep, setlistWindow } from './artistGrade';
import { ARTIST_CARD_RATIO, ARTIST_MATERIAL, CardFonts } from './cardTheme';
import { CardSignature } from './signature';
import { CardTilt } from './useCardTilt';
import { ArtistRewardCard, MasteredSong } from './types';

interface Props {
  card: ArtistRewardCard;
  width: number;
  tilt: CardTilt;
  fonts: CardFonts;
  /** 서명 없이 발급된 카드는 서명 칸에 이 이름을 대신 찍는다. 없으면 빈 칸. */
  ownerName?: string;
}

interface SignatureSlot {
  /** 빈 서명 칸을 이 색 점선으로 표시한다. */
  signatureHint?: string;
  /** card.signature 대신 그릴 서명. 서명하는 동안 획마다 카드를 새로 만들지 않으려고 따로 받는다. */
  signature?: CardSignature | null;
}

const PAPER = require('../../../assets/cards/paper-fiber.png');
const BRUSHED = require('../../../assets/cards/brushed-metal.png');
const MATTE = require('../../../assets/cards/matte-grain.png');
const SETLIST_ROWS = 5;
const SWAY_PERIOD_MS = 9000;

/** 가만히 들고 있어도 빛이 천천히 흔들리게, 효과가 따라가는 기울기에만 잔 흔들림을 더한다. 카드 자세는 그대로다. */
function useIdleSway(tilt: CardTilt): CardTilt {
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = withRepeat(withTiming(1, { duration: SWAY_PERIOD_MS, easing: Easing.linear }), -1, false);
  }, [phase]);
  const x = useDerivedValue(() => tilt.x.value + Math.cos(phase.value * Math.PI * 2) * 0.14);
  const y = useDerivedValue(() => tilt.y.value + Math.sin(phase.value * Math.PI * 4) * 0.07);
  return useMemo(() => ({ ...tilt, x, y }), [tilt, x, y]);
}

function ArtistCardShowcase({ card, width, tilt, fonts, ownerName }: Props) {
  const height = width * ARTIST_CARD_RATIO;
  const u = width / 100;
  const light = useIdleSway(tilt);

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
        <FrontFace card={card} width={width} height={height} u={u} tilt={light} fonts={fonts} />
      </Animated.View>
      <Animated.View style={[styles.face, { borderRadius: 4 * u }, backStyle]}>
        <BackFace card={card} width={width} height={height} u={u} tilt={light} fonts={fonts} ownerName={ownerName} />
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

/** 등급이 오를 때 새로 새겨지는 재질 각인의 중심. 앞면 오른쪽 위 회원 번호 줄(FrontFace)에서 어림한다. */
export function artistUpgradeFocus(card: ArtistRewardCard, width: number): { x: number; y: number } {
  const u = width / 100;
  const label = ARTIST_MATERIAL[artistGradeStep(card.masteredCount).grade].engrave ?? '';
  const textW = label.length * 3.4 * u;
  return { x: width - 6 * u - textW / 2, y: 6 * u + 1.8 * u };
}

/** 뒷면만 정적으로. 획득 연출에서 효과 없이 돌리거나 서명할 때 쓴다. */
export const ArtistCardBack = React.memo(function ArtistCardBack({
  card,
  width,
  fonts,
  ownerName,
  signatureHint,
  signature,
}: Omit<Props, 'tilt'> & SignatureSlot) {
  const height = width * ARTIST_CARD_RATIO;
  return (
    <View style={{ width, height }}>
      <BackFace
        card={card}
        width={width}
        height={height}
        u={width / 100}
        fonts={fonts}
        ownerName={ownerName}
        signatureHint={signatureHint}
        signature={signature}
      />
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

// 멤버십 카드처럼 사진을 끝까지 깐다. 사진 색은 모든 재질이 같고, 재질은 둘레 금속 모서리부터 차지하는 자리를 넓혀 간다.
// 썸네일(tilt 없음)도 재질만큼 빛이 멈춰 보이게 한다.
function FrontFace({ card, width, height, u, tilt, fonts }: FaceProps & { tilt?: CardTilt }) {
  const grade = artistGradeStep(card.masteredCount).grade;
  const m = ARTIST_MATERIAL[grade];

  return (
    <View style={[styles.clip, { borderRadius: 4 * u, backgroundColor: card.ink }]}>
      {tilt ? (
        <PhotoPlane uri={card.imageUrl} grade={grade} width={width} height={height} depth={m.parallax} tilt={tilt} />
      ) : (
        <ArtistPhoto uri={card.imageUrl} grade={grade} width={width} height={height} />
      )}
      {m.matte > 0 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.matte, { opacity: m.matte }]}>
          <Image source={MATTE} style={StyleSheet.absoluteFill} resizeMode="repeat" />
        </View>
      )}
      <LinearGradient
        colors={[`${card.ink}E6`, `${card.ink}80`, `${card.ink}00`]}
        locations={[0, 0.45, 0.85]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0.75, y: 0.2 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={['#00000066', '#00000000']} locations={[0, 0.35]} style={StyleSheet.absoluteFill} />
      {m.facet > 0 && <FacetLayer tilt={tilt} width={width} height={height} opacity={m.facet} />}
      {m.glitter > 0 && tilt && (
        <CardGlitter seed={card.id} width={width} height={height} tilt={tilt} strength={0.7 * m.glitter} rainbow={m.rainbow} />
      )}
      {m.rainbow > 0 && !tilt && <HoloLayer width={width} height={height} opacity={0.3 * m.rainbow} blend="color-dodge" />}
      {m.restSparkles > 0 && !tilt && <StaticSparkles seed={card.id} count={m.restSparkles} width={width} height={height} />}
      {/* 길로셰·로제트 선은 썸네일에서 1px 도 안 돼 무늬로 읽히지 않는다. */}
      {m.guilloche > 0 && m.foil && tilt && (
        <GuillocheLayer width={width} height={height} u={u} colors={m.foil} tilt={tilt} opacity={m.guilloche} />
      )}

      <View style={[styles.content, { padding: 6 * u }]}>
        {/* 멤버십 카드처럼 등급은 오른쪽 위, 회원 번호와 같은 줄에 둔다. */}
        <View style={styles.topRow}>
          <Text style={[styles.fanNo, { fontFamily: fonts.koBold, fontSize: 3 * u }]}>
            {`${card.sample ? '—' : card.fanNo.toLocaleString('ko-KR')}번째 팬`}
          </Text>
          {m.engrave && m.foil && (
            <FoilText
              text={m.engrave}
              colors={m.foil}
              fontFamily={fonts.jpHeavy}
              fontSize={3 * u}
              letterSpacing={1.2 * u}
              tilt={tilt}
              shadow
            />
          )}
        </View>
        <View style={{ gap: 1.6 * u }}>
          <CardName name={card.name} u={u} fontFamily={fonts.jpHeavy} emboss={m.emboss && !!tilt} tilt={tilt} />
          <Text style={[styles.since, { fontFamily: fonts.ko, fontSize: 2.6 * u }]}>
            {`${card.sample ? 'yyyy.mm.dd' : card.since.slice(0, 10).replace(/-/g, '.')}부터`}
          </Text>
        </View>
      </View>
      {m.rosette && tilt && <RosetteLayer width={width} height={height} u={u} colors={m.rosette} tilt={tilt} />}
      <GlareLayer tilt={tilt} width={width} height={height} gloss={m.gloss} />
      {m.rim > 0 && <RimLayer width={width} height={height} u={u} colors={m.frame} tilt={tilt} rim={m.rim} />}
    </View>
  );
}

/** depth 만큼 사진을 키워 깔고 기울기와 반대로 밀어, 사진이 카드 면 아래에 있는 것처럼 보이게 한다. */
function PhotoPlane({ uri, grade, width, height, depth, tilt }: {
  uri: string;
  grade: ArtistGrade;
  width: number;
  height: number;
  depth: number;
  tilt: CardTilt;
}) {
  const pad = depth * width;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -tilt.x.value * pad * 0.8 }, { translateY: -tilt.y.value * pad * 0.8 }],
  }));
  return (
    <Animated.View style={[styles.photo, { left: -pad, top: -pad, width: width + pad * 2, height: height + pad * 2 }, style]}>
      <ArtistPhoto uri={uri} grade={grade} width={width + pad * 2} height={height + pad * 2} />
    </Animated.View>
  );
}

/** 볼록하게 찍힌 이름: 흰 글씨는 그대로 두고 빛 쪽 모서리는 밝게, 반대쪽은 그늘지게 겹친다. */
function CardName({ name, u, fontFamily, emboss, tilt }: {
  name: string;
  u: number;
  fontFamily: string;
  emboss: boolean;
  tilt?: CardTilt;
}) {
  const text = { fontFamily, fontSize: 8.4 * u, lineHeight: 10.4 * u };
  const lift = 0.18 * u;
  const highlight = useAnimatedStyle(() => {
    const x = Math.max(-1, Math.min(1, (tilt?.x.value ?? -0.35) * 2));
    const y = Math.max(-1, Math.min(1, (tilt?.y.value ?? -0.25) * 2));
    return { transform: [{ translateX: x * lift }, { translateY: y * lift }] };
  });
  const shade = useAnimatedStyle(() => {
    const x = Math.max(-1, Math.min(1, (tilt?.x.value ?? -0.35) * 2));
    const y = Math.max(-1, Math.min(1, (tilt?.y.value ?? -0.25) * 2));
    return { transform: [{ translateX: -x * lift }, { translateY: -y * lift }] };
  });

  if (!emboss) {
    return (
      <Text style={[styles.name, text]} numberOfLines={2}>
        {name}
      </Text>
    );
  }
  return (
    <View>
      <Animated.Text style={[styles.name, styles.nameLayer, text, styles.nameShade, shade]} numberOfLines={2}>
        {name}
      </Animated.Text>
      <Animated.Text style={[styles.nameLayer, text, styles.nameHighlight, highlight]} numberOfLines={2}>
        {name}
      </Animated.Text>
      <Text style={[text, styles.nameFace]} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

// 뒷면은 재질로 만든 카드 몸체다. 동·은·금은 깊은 색 몸체에 박을 찍는다. 커버는 앨범 단위라 곡을 가르지 못해 제목 옆 곁들임으로만 쓴다.
function BackFace({
  card,
  width,
  height,
  u,
  tilt,
  fonts,
  ownerName,
  signatureHint,
  signature,
}: FaceProps & SignatureSlot & { tilt?: CardTilt; ownerName?: string }) {
  const grade = artistGradeStep(card.masteredCount).grade;
  const m = ARTIST_MATERIAL[grade];
  const ink = m.bodyInk;
  const pad = 5.4 * u;
  const leftW = 34 * u;
  const colGap = 4 * u;
  const rightW = width - pad * 2 - leftW - colGap;
  const rowH = 6.4 * u;
  const { start, hidden } = setlistWindow(card.masteredCount, SETLIST_ROWS);
  const shown = card.masteredSongs.slice(start);
  const label = { color: `${ink}A6` };

  return (
    <View style={[styles.clip, { borderRadius: 4 * u, backgroundColor: m.body[0] }]}>
      <LinearGradient colors={m.body} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }} style={StyleSheet.absoluteFill} />
      {grade === 'paper' && <Image source={PAPER} style={[StyleSheet.absoluteFill, styles.paper]} resizeMode="repeat" />}
      {grade !== 'paper' && m.facet === 0 && (
        <Image source={BRUSHED} style={[StyleSheet.absoluteFill, styles.brushed]} resizeMode="cover" />
      )}
      {m.facet > 0 && <FacetLayer tilt={tilt} width={width} height={height} opacity={m.facet} />}
      {m.rainbow > 0 && <HoloLayer tilt={tilt} width={width} height={height} opacity={0.4 * m.rainbow} blend="overlay" />}
      {m.facet > 0 && tilt && <CardGlitter seed={card.id} width={width} height={height} tilt={tilt} strength={0.6 * m.glitter} />}
      <Text style={[styles.watermark, { color: `${ink}14`, fontFamily: fonts.jpHeavy, fontSize: 22 * u, right: -2 * u, bottom: -5 * u }]}>
        言の葉
      </Text>

      <View style={[styles.backBody, { padding: pad, gap: colGap }]}>
        <View style={[styles.backLeft, { width: leftW }]}>
          <View>
            <Text style={[label, { fontFamily: fonts.ko, fontSize: 2.6 * u }]}>MASTER 카드</Text>
            <View style={styles.countRow}>
              {m.bodyFoil && m.foil ? (
                <FoilText
                  text={String(card.masteredCount)}
                  colors={m.foil}
                  fontFamily={fonts.jpHeavy}
                  fontSize={16 * u}
                  lineHeight={18 * u}
                  tilt={tilt}
                />
              ) : (
                <Text style={[styles.countValue, { color: ink, fontFamily: fonts.jpHeavy, fontSize: 16 * u, lineHeight: 18 * u }]}>
                  {card.masteredCount}
                </Text>
              )}
              <Text style={[label, { fontFamily: fonts.koBold, fontSize: 5 * u, lineHeight: 6.4 * u }]}>곡</Text>
            </View>
          </View>
          <SignatureField
            signature={signature === undefined ? card.signature : signature}
            fallbackName={ownerName}
            hint={signatureHint}
            u={u}
            fonts={fonts}
            ink={ink}
          />
        </View>

        <View style={{ width: rightW }}>
          <View style={[styles.listHead, { height: 4.4 * u }]}>
            <Text style={[label, { fontFamily: fonts.ko, fontSize: 2.6 * u }]}>최근</Text>
            {hidden > 0 && <Text style={[label, { fontFamily: fonts.ko, fontSize: 2.4 * u }]}>외 {hidden}곡</Text>}
          </View>
          {shown.map((song, i) => (
            <SetlistRow key={i} no={start + i + 1} song={song} height={rowH} u={u} fonts={fonts} ink={ink} />
          ))}
        </View>
      </View>
      <GlareLayer tilt={tilt} width={width} height={height} gloss={m.gloss} />
    </View>
  );
}

const SetlistRow = React.memo(function SetlistRow({ no, song, height, u, fonts, ink }: {
  no: number;
  ink: string;
  song: MasteredSong;
  height: number;
  u: number;
  fonts: CardFonts;
}) {
  return (
    <View style={[styles.setlistRow, { height, gap: 1.4 * u }]}>
      <Text style={[styles.setlistNo, { color: `${ink}8C`, fontFamily: fonts.jp, fontSize: 2.2 * u, width: 3.4 * u }]}>{String(no).padStart(2, '0')}</Text>
      <Image source={{ uri: song.artworkUrl }} style={[styles.cover, { width: 3.4 * u, height: 3.4 * u, borderRadius: 0.5 * u }]} />
      <Text style={[styles.setlistTitle, { color: ink, fontFamily: fonts.jp, fontSize: 3.3 * u }]} numberOfLines={1}>
        {song.title}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
  },
  clip: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, justifyContent: 'space-between' },
  fanNo: { color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  since: { color: '#FFFFFFB8', fontVariant: ['tabular-nums'] },
  photo: { position: 'absolute' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: '#FFFFFF', textShadowColor: '#00000080', textShadowRadius: 12 },
  nameLayer: { position: 'absolute', left: 0, right: 0, top: 0 },
  nameShade: { color: '#00000099' },
  nameHighlight: { color: '#FFFFFF' },
  // 밝은 모서리가 보이도록 면은 흰색보다 한 톤 낮춘다.
  nameFace: { color: '#E9E6EE' },
  watermark: { position: 'absolute' },
  paper: { opacity: 0.55 },
  matte: { mixBlendMode: 'overlay' },
  brushed: { opacity: 0.32, mixBlendMode: 'overlay' },
  backBody: { flex: 1, flexDirection: 'row' },
  backLeft: { justifyContent: 'space-between' },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  setlistRow: { flexDirection: 'row', alignItems: 'center' },
  setlistNo: { fontVariant: ['tabular-nums'] },
  setlistTitle: { flex: 1 },
  countRow: { flexDirection: 'row', alignItems: 'flex-end' },
  countValue: { fontVariant: ['tabular-nums'] },
  cover: { backgroundColor: '#00000014', borderWidth: StyleSheet.hairlineWidth, borderColor: '#00000033' },
});
