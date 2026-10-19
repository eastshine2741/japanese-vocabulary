import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { bodyPath, edgePath, peelPath } from './tearPath';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);

/** 찢긴 단면 — 겉면 아래 흰 종이 결이 드러난다. */
const FIBER = '#FFF8EC';
const MAX_PEEL = 0.13;

/** 0~1 만큼 흰색(+)·검정(-)을 섞는다. */
function tint(hex: string, k: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const to = k > 0 ? 255 : 0;
  const a = Math.abs(k);
  const ch = (v: number) => Math.round(v + (to - v) * a).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

interface Props {
  width: number;
  height: number;
  /** 모서리 반경. */
  radius: number;
  accent: string;
  /** 절취선 높이. 찢는 손가락이 처음 닿을 자리를 알려 준다. */
  perfY: number;
  /** 찢는 손가락이 오갈 수 있는 띠의 아래 끝. 그 아래에 무늬를 둔다. */
  bandBottom: number;
  trail: SharedValue<number[]>;
  /** 0→1 찢은 정도. 손가락 x 를 폭으로 나눈 값. */
  tear: SharedValue<number>;
  tipY: SharedValue<number>;
  /** 다 찢긴 조각이 날아가는 진행. */
  stripOff: SharedValue<number>;
}

/** 카드의 색으로 물든 봉투. 찢긴 조각은 손가락 자리를 축으로 들린다. */
function CardEnvelope({ width: w, height: h, radius: r, accent, perfY, bandBottom, trail, tear, tipY, stripOff }: Props) {
  const body = useAnimatedProps(() => ({ d: bodyPath(trail.value, Math.max(0, tear.value) * w, tipY.value, w, h, r) }));
  const cut = useAnimatedProps(() => ({
    d: edgePath(trail.value, Math.max(0, tear.value) * w, tipY.value),
    strokeOpacity: tear.value > 0 ? 1 : 0,
  }));
  const perf = useAnimatedProps(() => ({ x1: Math.min(w - 10, Math.max(10, Math.max(0, tear.value) * w + 6)) }));
  const peel = (lift: number) => {
    'worklet';
    return peelPath(trail.value, Math.max(0, tear.value) * w, tipY.value, r, MAX_PEEL * Math.min(1, tear.value * 2), lift + 6 * tear.value);
  };
  const piece = useAnimatedProps(() => ({ d: peel(0).piece }));
  const pieceShadow = useAnimatedProps(() => ({ d: peel(-4).piece }));
  const pieceEdge = useAnimatedProps(() => ({ d: peel(0).edge }));
  const flyStyle = useAnimatedStyle(() => ({
    opacity: 1 - stripOff.value,
    transform: [
      { translateX: stripOff.value * w * 0.5 },
      { translateY: -stripOff.value * 160 },
      { rotate: `${stripOff.value * 24}deg` },
    ],
  }));

  const light = tint(accent, 0.28);
  const deep = tint(accent, -0.5);
  const ink = tint(accent, -0.62);
  const apexY = bandBottom + w * 0.36;
  const fill = (id: string) => (
    <LinearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={w * 0.35} y2={w * 0.9}>
      <Stop offset="0" stopColor={light} />
      <Stop offset="0.45" stopColor={accent} />
      <Stop offset="1" stopColor={deep} />
    </LinearGradient>
  );

  return (
    <>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          {fill('envFill')}
          <LinearGradient id="envSheen" gradientUnits="userSpaceOnUse" x1="0" y1={bandBottom} x2={w} y2={bandBottom + w * 0.5}>
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity={0.2} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <AnimatedPath animatedProps={body} fill="url(#envFill)" />
        <G>
          {/* 뒷면 아래 날개 — 양 모서리에서 가운데로 접혀 올라온다. */}
          <Path d={`M0 ${h}L0 ${bandBottom + 18}L${w / 2} ${apexY}L${w} ${bandBottom + 18}L${w} ${h}Z`} fill="#000000" fillOpacity={0.1} />
          <Path d={`M0 ${bandBottom + 18}L${w / 2} ${apexY}L${w} ${bandBottom + 18}`} stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={1.2} fill="none" />
          <Path d={`M0 ${h}L${w / 2} ${apexY + w * 0.08}L${w} ${h}`} stroke="#000000" strokeOpacity={0.16} strokeWidth={1.2} fill="none" />
          <Path d={`M0 ${bandBottom}L${w} ${bandBottom}L${w} ${bandBottom + w * 0.5}L0 ${bandBottom + w * 0.5}Z`} fill="url(#envSheen)" />
          <SvgText
            x={w / 2}
            y={bandBottom + (apexY - bandBottom) * 0.42}
            fill={ink}
            fillOpacity={0.72}
            fontSize={11}
            fontWeight="700"
            letterSpacing={4}
            textAnchor="middle"
          >
            KOTONOHA
          </SvgText>
          <Line x1={w / 2 - 14} y1={bandBottom + (apexY - bandBottom) * 0.58} x2={w / 2 + 14} y2={bandBottom + (apexY - bandBottom) * 0.58} stroke={ink} strokeOpacity={0.45} strokeWidth={1} />
        </G>
        <AnimatedLine animatedProps={perf} x2={w - 10} y1={perfY} y2={perfY} stroke={ink} strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4 4" />
        <AnimatedPath animatedProps={cut} stroke={FIBER} strokeWidth={2.2} strokeLinejoin="round" fill="none" />
      </Svg>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, flyStyle]}>
        <Svg width={w} height={h}>
          <Defs>{fill('envPeelFill')}</Defs>
          <AnimatedPath animatedProps={pieceShadow} fill="#000000" fillOpacity={0.28} />
          <AnimatedPath animatedProps={piece} fill="url(#envPeelFill)" />
          <AnimatedPath animatedProps={pieceEdge} stroke={FIBER} strokeWidth={2.2} strokeLinejoin="round" fill="none" />
        </Svg>
      </Animated.View>
    </>
  );
}

export default React.memo(CardEnvelope);
