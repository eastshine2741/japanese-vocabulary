import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Path } from 'react-native-svg';
import { CardTilt } from './useCardTilt';
import { coatingLeft } from './cardWear';
import { CardSide, ramp, wearGeometry } from './wearGeometry';

interface Props {
  width: number;
  height: number;
  /** 0 = 새것, 1 = 완전히 낡음 (cardWear.wearAge). */
  age: number;
  seed: string;
  /** 뒷면은 앞면과 같은 접힘·찢어짐을 좌우 반전해 그린다. */
  side?: CardSide;
  /** 있으면 잔흠집이 빛을 받는 각도에서만 드러난다. */
  tilt?: CardTilt;
}

const GRIME = require('../../../assets/cards/wear-grime.png');
const SCRATCHES = require('../../../assets/cards/wear-scratches.png');
const PAPER = require('../../../assets/cards/paper-fiber.png');

const PAPER_EDGE = '#EFE7D6';
const PAPER_FIBER = '#F3ECDD';

function CardWearLayer({ width, height, age, seed, side = 'front', tilt }: Props) {
  const g = useMemo(() => wearGeometry(seed, width, height, age, side), [seed, width, height, age, side]);
  if (age <= 0) return null;
  const u = width / 100;
  const clipId = `wear-${seed}-${side}-${Math.round(width)}`;
  const back = side === 'back';
  const mirror = back ? `translate(${width} 0) scale(-1 1)` : undefined;
  const edgeAlpha = Math.min(1, g.edgeOpacity * 3);
  const coating = coatingLeft(age);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, styles.desaturate, { opacity: age * 0.75 }]} />
      <View style={[StyleSheet.absoluteFill, styles.sepia, { opacity: age * 0.45 }]} />
      <View style={[StyleSheet.absoluteFill, styles.liftBlacks, { opacity: age * 0.55 }]} />
      <View style={[StyleSheet.absoluteFill, styles.multiply, { opacity: ramp(0.15, 1, age) * 0.6 }]}>
        <Image source={PAPER} style={{ width, height }} resizeMode="repeat" />
      </View>
      <Image source={GRIME} style={[StyleSheet.absoluteFill, { width, height, opacity: g.grime * 0.85 }]} resizeMode="stretch" />
      {tilt ? (
        <ScratchShine tilt={tilt} width={width} height={height} strength={g.scratch} gloss={coating} />
      ) : (
        <Image source={SCRATCHES} style={[StyleSheet.absoluteFill, { width, height, opacity: g.scratch * 0.45 }]} resizeMode="stretch" />
      )}

      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {g.peels.map((p, i) => (
            <ClipPath key={i} id={`${clipId}-${i}`}>
              <Path d={p.d} />
            </ClipPath>
          ))}
        </Defs>

        <G transform={mirror}>
          {g.creases.map((c, i) => (
            <Path key={`cf${i}`} d={c.face} fill={c.faceLight ? '#FFFFFF' : '#000000'} fillOpacity={(c.faceLight ? 0.09 : 0.1) * c.opacity} />
          ))}
        </G>

        {g.stain && (
          <G opacity={g.stain.opacity}>
            <Path d={g.stain.blob} fill="#7A5424" fillOpacity={0.08} />
            <Path d={g.stain.halo} fill="none" stroke="#7A5424" strokeOpacity={0.14} strokeWidth={2.4 * u} strokeLinecap="round" />
            <Path d={g.stain.ring} fill="none" stroke="#5E3E16" strokeOpacity={0.5} strokeWidth={0.6 * u} strokeLinecap="round" />
          </G>
        )}

        <G transform={mirror}>
          {g.creases.map((c, i) => {
            // 앞면의 산접기는 뒷면에선 골접기라 그늘과 하이라이트가 뒤바뀐다.
            const dark = back ? c.highlight : c.shadow;
            const light = back ? c.shadow : c.highlight;
            return (
              <G key={`c${i}`} opacity={c.opacity}>
                <Path d={dark} fill="none" stroke="#000000" strokeOpacity={0.06} strokeWidth={5 * u} />
                <Path d={c.ridge} fill="none" stroke="#000000" strokeOpacity={0.1} strokeWidth={2.6 * u} />
                <Path d={dark} fill="none" stroke="#000000" strokeOpacity={0.3} strokeWidth={1.1 * u} />
                <Path d={light} fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={0.35 * u} />
                <Path d={c.cracks} fill="none" stroke="#F4EEE2" strokeOpacity={0.9} strokeWidth={0.32 * u} strokeLinecap="round" />
              </G>
            );
          })}

          <Path d={g.edgeHaze} fill={PAPER_EDGE} fillRule="evenodd" fillOpacity={edgeAlpha * 0.3} />
          <Path d={g.edge} fill={PAPER_EDGE} fillRule="evenodd" fillOpacity={edgeAlpha * 0.92} />
          {g.specks.map((s, i) => (
            <Circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill="#F6F0E2" fillOpacity={s.o} />
          ))}
          {g.flakes !== '' && <Path d={g.flakes} fill="#E8DFCB" fillOpacity={0.9} />}
        </G>

        {g.peels.map((p, i) => {
          const side = Math.max(p.bbox.w, p.bbox.h);
          return (
            <G key={`p${i}`} opacity={g.peelOpacity}>
              <G clipPath={`url(#${clipId}-${i})`}>
                <SvgImage href={PAPER} x={p.bbox.x} y={p.bbox.y} width={side} height={side} preserveAspectRatio="none" />
              </G>
              <Path d={p.d} fill="none" stroke="#1E140A" strokeOpacity={0.7} strokeWidth={0.9 * u} />
              <Path d={p.lip} fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={0.3 * u} />
            </G>
          );
        })}

        {g.rip && (
          <G opacity={g.rip.opacity} transform={mirror}>
            <Path d={g.rip.gap} fill="#0A0705" fillOpacity={0.9} />
            <Path d={g.rip.sideA} fill="none" stroke={PAPER_FIBER} strokeWidth={0.5 * u} />
            <Path d={g.rip.sideB} fill="none" stroke={PAPER_FIBER} strokeWidth={0.5 * u} />
            <Path d={g.rip.fibers} fill="none" stroke={PAPER_FIBER} strokeOpacity={0.7} strokeWidth={0.18 * u} />
            {/* 테이프는 앞면에만 붙였다. */}
            {!back && (
              <>
                <Path d={g.rip.tape.d} fill="#E8D48C" fillOpacity={0.6} stroke="#6E5728" strokeOpacity={0.35} strokeWidth={0.3 * u} />
                <Path d={g.rip.tape.edges} fill="none" stroke="#5A4520" strokeOpacity={0.25} strokeWidth={0.8 * u} />
                <Path d={g.rip.tape.shine} fill="none" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={u} strokeLinecap="round" />
              </>
            )}
          </G>
        )}
      </Svg>
    </View>
  );
}

export default React.memo(CardWearLayer);

function ScratchShine({ tilt, width, height, strength, gloss }: {
  tilt: CardTilt;
  width: number;
  height: number;
  strength: number;
  gloss: number;
}) {
  // 흠집이 빛나는 건 코팅이 빛을 받아서다. 코팅이 벗겨지면 기울여도 더 밝아지지 않는다.
  const style = useAnimatedStyle(() => ({
    opacity: strength * (0.3 + gloss * Math.min(0.7, (Math.abs(tilt.x.value) + Math.abs(tilt.y.value)) * 0.9)),
  }));
  return <Animated.Image source={SCRATCHES} style={[StyleSheet.absoluteFill, { width, height }, style]} resizeMode="stretch" />;
}

const styles = StyleSheet.create({
  desaturate: { backgroundColor: '#808080', mixBlendMode: 'saturation' },
  sepia: { backgroundColor: '#A07A3C', mixBlendMode: 'multiply' },
  liftBlacks: { backgroundColor: '#4A3B26', mixBlendMode: 'screen' },
  multiply: { mixBlendMode: 'multiply' },
});
