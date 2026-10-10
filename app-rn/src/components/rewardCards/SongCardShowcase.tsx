import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import CardGlitter from './CardGlitter';
import CardWearLayer from './CardWearLayer';
import { EtchLayer, GlareLayer, HoloLayer, StaticSparkles } from './CardLayers';
import FoilText from './FoilText';
import LenticularLayer from './LenticularLayer';
import LevelPips from './LevelPips';
import MasterPips from './MasterPips';
import SignatureField from './SignatureField';
import { CARD_RATIO, CardFonts, LEVEL_MATERIAL, MASTER_CHIP, MASTER_PIP } from './cardTheme';
import { CardSignature } from './signature';
import { cardArtist, cardTitle } from './cardCredit';
import { coatingLeft, wearAge } from './cardWear';
import { lyricFitScale, lyricRowFitScale, lyricText, textFitScale } from './cardLyric';
import { CardTilt } from './useCardTilt';
import { SongRewardCard } from './types';
import { verticalText } from './verticalText';

const MATTE = require('../../../assets/cards/matte-grain.png');
const BRUSHED = require('../../../assets/cards/brushed-metal.png');
/** 세로 가사는 글자 하나가 한 줄이다. */
const LYRIC_MAX_CHARS = 40;
// Android 는 흐림 반경을 25 까지만 받는다.
const BACK_ART_BLUR = 24;

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
        <BackFace card={card} width={width} height={height} u={u} age={age} tilt={tilt} fonts={fonts} ownerName={ownerName} />
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

/**
 * 등급이 오를 때 새로 박히는 다이아의 중심. 앞면 배치(FrontFace·FoilFrontFace)에서 계산한다.
 * 마스터는 다이아가 늘지 않고 셋이 함께 푸르게 바뀌어 줄 가운데를 짚는다.
 */
export function songUpgradeFocus(card: SongRewardCard, width: number): { x: number; y: number } {
  const u = width / 100;
  const height = width * CARD_RATIO;
  const size = 2.4 * u;
  const step = size * 1.75;
  if (card.mastered) return { x: width - 7 * u - 2 - size * 1.5 - size * 0.75, y: height - 7 * u - size / 2 };
  const right = width - 6.8 * u - 2;
  return { x: right - size / 2 - (3 - Math.max(1, card.level)) * step, y: height - 6.8 * u - size / 2 };
}

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
  // 아트 위아래 여백(5u·4u)을 뺀 높이 안에서 세로 가사가 아트 밖으로 잘리지 않게 줄인다.
  const lyricScale = lyricFitScale(card.lyric, artSize - 9 * u, 6.4 * u, 7 * u);
  const titleScale = textFitScale([cardTitle(card.title)], artSize - pad * 2 - 2, 6.8 * u);

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
            {card.lyric.map((line, i) =>
              material.foil && material.foilLyrics ? (
                <FoilText
                  key={line.index}
                  text={verticalText(lyricText(line))}
                  colors={material.foil}
                  fontFamily={fonts.jp}
                  fontSize={5.4 * u * lyricScale}
                  lineHeight={6.4 * u * lyricScale}
                  numberOfLines={LYRIC_MAX_CHARS}
                  tilt={tilt}
                  shadow
                  style={{ marginTop: i * 7 * u * lyricScale }}
                />
              ) : (
                <Text
                  key={line.index}
                  style={[
                    styles.lyricCol,
                    { fontFamily: fonts.jp, fontSize: 5.4 * u * lyricScale, lineHeight: 6.4 * u * lyricScale, marginTop: i * 7 * u * lyricScale },
                  ]}
                >
                  {verticalText(lyricText(line))}
                </Text>
              ),
            )}
          </View>
          {card.level === 3 && tilt && <CardGlitter seed={card.id} width={artSize} height={artSize} tilt={tilt} strength={foil} />}
          {material.restSparkles > 0 && !tilt && (
            <StaticSparkles seed={card.id} count={Math.round(material.restSparkles * foil)} width={artSize} height={artSize} />
          )}
        </View>

        <LinearGradient
          colors={material.tint ? [`${card.accent}38`, `${card.ink}00`] : [`${card.ink}00`, `${card.ink}00`]}
          style={[styles.meta, { borderRadius: 2.4 * u, padding: 3.4 * u, backgroundColor: card.ink }]}
        >
          {material.foil ? (
            <FoilText
              text={cardTitle(card.title)}
              colors={material.foil}
              fontFamily={fonts.jpHeavy}
              fontSize={6.8 * u * titleScale}
              lineHeight={8.4 * u}
              tilt={tilt}
            />
          ) : (
            <Text style={[styles.title, { fontFamily: fonts.jpHeavy, fontSize: 6.8 * u * titleScale, lineHeight: 8.4 * u }]} numberOfLines={1}>
              {cardTitle(card.title)}
            </Text>
          )}
          <Text style={[styles.artist, { fontSize: 3.4 * u, color: material.tint ? card.accent : '#A8A194' }]} numberOfLines={1}>{cardArtist(card.artist)}</Text>
          <View style={styles.metaFoot}>
            <OwnerMark no={card.sample ? null : card.ownerNo} u={u} fonts={fonts} />
            <LevelPips level={card.level} color={material.pip} size={2.4 * u} />
          </View>
        </LinearGradient>
      </View>

      {material.matte > 0 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.matte, { opacity: material.matte }]}>
          <Image source={MATTE} style={StyleSheet.absoluteFill} resizeMode="repeat" />
        </View>
      )}
      <CardWearLayer width={width} height={height} age={age} seed={card.id} tilt={tilt} lite={thumb} />
      {/* 종이는 코팅이 없어 낡아도 광택이 그대로다. */}
      <GlareLayer tilt={tilt} width={width} height={height} gloss={material.matte > 0 ? material.gloss : material.gloss * foil} />
    </View>
  );
}

/** 마스터 카드. 테 없이 아트를 끝까지 깔고, 무지개 코팅이 두 장면 위를 함께 덮는다. */
function FoilFrontFace({ card, width, height, u, age, tilt, fonts, thumb }: FaceProps & { tilt?: CardTilt }) {
  const foil = coatingLeft(age);
  const inset = 2.6 * u;
  // 아래 제목·아티스트·순번 묶음(약 26u)과 위아래 여백을 뺀 높이 안에 세로 가사를 넣는다.
  const lyricScale = lyricFitScale(card.lyric, height - 7 * u - 7 * u - 26 * u - 4 * u, 7.2 * u, 8 * u);
  const titleScale = textFitScale([cardTitle(card.title)], width - 14 * u - 2, 8 * u);

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
              { fontFamily: fonts.jp, fontSize: 6 * u * lyricScale, lineHeight: 7.2 * u * lyricScale, marginTop: i * 8 * u * lyricScale },
            ]}
          >
            {verticalText(lyricText(line))}
          </Text>
        ))}
      </View>

      <View style={[styles.foilMeta, { left: 7 * u, right: 7 * u, bottom: 7 * u, gap: 1.2 * u }]}>
        <Text style={[styles.title, { fontFamily: fonts.jpHeavy, fontSize: 8 * u * titleScale, lineHeight: 10 * u }]} numberOfLines={1}>
          {cardTitle(card.title)}
        </Text>
        <Text style={[styles.artist, { fontSize: 3.6 * u, color: card.accent }]} numberOfLines={1}>{cardArtist(card.artist)}</Text>
        <View style={[styles.metaFoot, { marginTop: 2.4 * u }]}>
          <OwnerMark no={card.sample ? null : card.ownerNo} u={u} fonts={fonts} />
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

function OwnerMark({ no, u, fonts }: { no: number | null; u: number; fonts: CardFonts }) {
  return (
    <View style={styles.owner}>
      <Text style={[styles.ownerNo, { fontFamily: fonts.jpHeavy, fontSize: 6 * u, lineHeight: 7 * u }]}>
        {no == null ? '—' : no.toLocaleString('ko-KR')}
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
  tilt,
  fonts,
  ownerName,
  signatureHint,
  signature,
}: FaceProps & SignatureSlot & { tilt?: CardTilt; ownerName?: string }) {
  // 아티스트 카드처럼 뒷면은 앞면 테와 같은 재질의 몸체다. 마스터는 앞면 아트를 흐리게 번져 깔고 무지개 코팅을 그대로 이어 덮는다.
  const material = card.mastered ? null : LEVEL_MATERIAL[card.level];
  const ink = material ? material.chipText : '#FFFFFF';
  const foil = coatingLeft(age);
  const stats = card.sample
    ? [
        { label: '획득 순번', value: '—', unit: '' },
        { label: '획득한 날', value: 'yyyy.mm.dd', unit: '' },
      ]
    : [
        { label: '획득 순번', value: card.ownerNo.toLocaleString('ko-KR'), unit: '번째' },
        { label: '획득한 날', value: card.earnedAt.slice(0, 10).replace(/-/g, '.'), unit: '' },
      ];
  // 좌우 여백 6u 를 뺀 폭에 가장 긴 줄이 한 줄로 들어가게 줄인다.
  const lyricScale = lyricRowFitScale(card.lyric, width - 12 * u, 5.8 * u, 2.4 * u);
  // 번역은 왼쪽 세로줄(2px)과 들여쓰기(2.6u)만큼 더 좁다.
  const koScale = textFitScale(card.lyric.map((line) => line.ko), width - 12 * u - 2.6 * u - 2, 3.6 * u);
  return (
    <View style={[styles.clip, { borderRadius: 4.6 * u, backgroundColor: material ? material.body[0] : card.ink }]}>
      {material ? (
        <>
          <LinearGradient colors={material.body} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.matte, { opacity: material.matte > 0 ? material.matte : 0.3 }]}>
            <Image source={material.matte > 0 ? MATTE : BRUSHED} style={StyleSheet.absoluteFill} resizeMode={material.matte > 0 ? 'repeat' : 'cover'} />
          </View>
        </>
      ) : (
        <MasterBackBody card={card} width={width} height={height} foil={foil} tilt={tilt} />
      )}
      <Text
        style={[
          styles.watermark,
          { color: `${ink}${material ? '1A' : '17'}`, fontFamily: fonts.jpHeavy, fontSize: 30 * u, lineHeight: 32 * u, right: -4 * u, bottom: 10 * u },
        ]}
      >
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
                    <Text style={[{ color: `${ink}B3`, fontSize: 2.4 * u * lyricScale, lineHeight: 3.2 * u * lyricScale }]}>{seg.reading ?? ' '}</Text>
                    <Text style={[{ color: ink, fontFamily: fonts.jp, fontSize: 5.8 * u * lyricScale, lineHeight: 7.4 * u * lyricScale }]}>{seg.text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
          <View style={[styles.backKo, { borderLeftColor: material ? `${ink}59` : MASTER_PIP, paddingLeft: 2.6 * u }]}>
            {card.lyric.map((line) => (
              <Text
                key={line.index}
                style={{ color: `${ink}C7`, fontFamily: fonts.ko, fontSize: 3.6 * u * koScale, lineHeight: 5.4 * u * koScale }}
                numberOfLines={1}
              >
                {line.ko}
              </Text>
            ))}
          </View>

          <View style={{ flex: 1, gap: 1.6 * u }}>
            {card.words.map((word) => (
              <View key={word.japanese} style={[styles.wordRow, { borderBottomColor: `${ink}24`, paddingBottom: 1.4 * u, gap: 2.4 * u }]}>
                <Text style={[{ color: ink, fontFamily: fonts.jp, fontSize: 4.2 * u }]}>{word.japanese}</Text>
                <Text style={[styles.wordMeaning, { color: `${ink}B3`, fontFamily: fonts.ko, fontSize: 3.2 * u }]} numberOfLines={1}>
                  <Text style={{ fontFamily: fonts.jp }}>{word.reading}</Text> · {word.meaning}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={{ flex: 1, gap: 0.6 * u }}>
              <Text style={[{ color: `${ink}8C`, fontFamily: fonts.ko, fontSize: 2.6 * u }]}>{s.label}</Text>
              {material ? (
                <Text style={[styles.statValue, { color: ink, fontSize: 4 * u }]}>
                  {s.value}
                  <Text style={[{ color: `${ink}8C`, fontFamily: fonts.ko, fontSize: 2.4 * u }]}>{s.unit}</Text>
                </Text>
              ) : (
                <View style={styles.statFoilRow}>
                  <FoilText text={s.value} colors={MASTER_CHIP.frame} fontFamily={fonts.jpHeavy} fontSize={4.4 * u} lineHeight={5.4 * u} tilt={tilt} />
                  {!!s.unit && <Text style={[{ color: `${ink}8C`, fontFamily: fonts.ko, fontSize: 2.4 * u }]}>{s.unit}</Text>}
                </View>
              )}
            </View>
          ))}
          {!material && (
            <View style={styles.statPips}>
              <MasterPips level={card.level} size={2.4 * u} tilt={tilt} />
            </View>
          )}
        </View>
        <SignatureField
          signature={signature === undefined ? card.signature : signature}
          fallbackName={ownerName}
          hint={signatureHint}
          u={u}
          fonts={fonts}
          ink={material ? ink : undefined}
        />
      </View>
      {!material && (
        <View
          pointerEvents="none"
          style={[styles.foilEdge, { top: 2.6 * u, left: 2.6 * u, right: 2.6 * u, bottom: 2.6 * u, borderRadius: 4.6 * u - 2.6 * u * 0.6 }]}
        />
      )}
      <CardWearLayer width={width} height={height} age={age} seed={card.id} side="back" />
      {!material && <GlareLayer tilt={tilt} width={width} height={height} gloss={foil} />}
    </View>
  );
}

/** 마스터 뒷면 몸체. 글씨가 읽히게 아트는 흐리고 어둡게 눌러 곡 색만 남긴다. */
function MasterBackBody({ card, width, height, foil, tilt }: {
  card: SongRewardCard;
  width: number;
  height: number;
  foil: number;
  tilt?: CardTilt;
}) {
  return (
    <>
      <Image source={{ uri: card.artworkUrl }} style={[StyleSheet.absoluteFill, styles.backArt]} resizeMode="cover" blurRadius={BACK_ART_BLUR} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: card.accent, mixBlendMode: 'color', opacity: 0.5 }]} />
      <LinearGradient
        colors={[`${card.ink}99`, `${card.ink}CC`, `${card.ink}F2`]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <HoloLayer tilt={tilt} width={width} height={height} opacity={0.35 * foil} blend="overlay" />
      {tilt ? (
        <CardGlitter seed={`${card.id}-back`} width={width} height={height} tilt={tilt} strength={0.4 * foil} rainbow={0.7 * foil} />
      ) : (
        <StaticSparkles seed={`${card.id}-back`} count={Math.round(6 * foil)} width={width} height={height} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  matte: { mixBlendMode: 'overlay' },
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
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
  watermark: { position: 'absolute', textAlign: 'center' },
  rubyLine: { flexDirection: 'row', alignItems: 'flex-end' },
  rubySeg: { alignItems: 'center' },
  backKo: { borderLeftWidth: 2 },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  wordMeaning: { flex: 1 },
  backBody: { flex: 1, minHeight: 0, overflow: 'hidden' },
  stats: { flexDirection: 'row', gap: 8 },
  statValue: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  statFoilRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  statPips: { alignSelf: 'flex-end', paddingBottom: 2 },
  backArt: { transform: [{ scale: 1.3 }] },
});
