import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { seededRandom } from './cardTheme';

interface Props {
  width: number;
  height: number;
  /** 0 = 새것, 1 = 완전히 낡음 (cardWear.wearAge). */
  age: number;
  seed: string;
}

const EDGE = '#3E2C14';

function CardWearLayer({ width, height, age, seed }: Props) {
  const marks = useMemo(() => {
    const rnd = seededRandom(seed);
    const scratches = Array.from({ length: 26 }, () => {
      const x = rnd() * width;
      const y = rnd() * height;
      const len = (0.05 + rnd() * 0.22) * width;
      const a = rnd() * Math.PI;
      const bend = (rnd() - 0.5) * len * 0.3;
      return {
        d: `M${x} ${y} Q${x + Math.cos(a) * len * 0.5 + bend} ${y + Math.sin(a) * len * 0.5} ${x + Math.cos(a) * len} ${y + Math.sin(a) * len}`,
        o: 0.15 + rnd() * 0.35,
        w: 0.4 + rnd() * 0.8,
      };
    });
    const fray = Array.from({ length: 90 }, () => {
      const side = Math.floor(rnd() * 4);
      const t = rnd();
      const depth = Math.pow(rnd(), 3) * width * 0.03;
      const x = side === 0 ? depth : side === 1 ? width - depth : t * width;
      const y = side === 2 ? depth : side === 3 ? height - depth : t * height;
      return { x, y, r: 0.4 + rnd() * 0.9, o: 0.3 + rnd() * 0.5 };
    });
    const creaseX = width * (0.35 + rnd() * 0.3);
    return { scratches, fray, creaseX, tilt: (rnd() - 0.5) * width * 0.25 };
  }, [seed, width, height]);

  if (age <= 0) return null;
  const crease = Math.min(1, Math.max(0, (age - 0.55) * 2.4));
  const edge = width * 0.14;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, styles.desaturate, { opacity: age * 0.75 }]} />
      <View style={[StyleSheet.absoluteFill, styles.sepia, { opacity: age * 0.5 }]} />
      <View style={[StyleSheet.absoluteFill, { opacity: age }]}>
        <LinearGradient colors={[EDGE, 'transparent']} style={[styles.edgeTop, { height: edge }]} />
        <LinearGradient colors={['transparent', EDGE]} style={[styles.edgeBottom, { height: edge }]} />
        <LinearGradient colors={[EDGE, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.edgeLeft, { width: edge }]} />
        <LinearGradient colors={['transparent', EDGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.edgeRight, { width: edge }]} />
      </View>
      <Svg width={width} height={height} style={[StyleSheet.absoluteFill, { opacity: age }]}>
        {marks.scratches.map((s, i) => (
          <Path key={i} d={s.d} stroke="#FFFFFF" strokeOpacity={s.o} strokeWidth={s.w} strokeLinecap="round" fill="none" />
        ))}
        {marks.fray.map((f, i) => (
          <Circle key={`f${i}`} cx={f.x} cy={f.y} r={f.r} fill="#FFF8EA" fillOpacity={f.o} />
        ))}
      </Svg>
      {crease > 0 && (
        <Svg width={width} height={height} style={[StyleSheet.absoluteFill, { opacity: crease }]}>
          <Line x1={marks.creaseX + marks.tilt} y1={0} x2={marks.creaseX - marks.tilt} y2={height} stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1} />
          <Line x1={marks.creaseX + marks.tilt + 1.2} y1={0} x2={marks.creaseX - marks.tilt + 1.2} y2={height} stroke="#000000" strokeOpacity={0.35} strokeWidth={1.2} />
          <Line x1={0} y1={height * 0.72} x2={width} y2={height * 0.64} stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={0.8} />
        </Svg>
      )}
    </View>
  );
}

export default React.memo(CardWearLayer);

const styles = StyleSheet.create({
  desaturate: { backgroundColor: '#808080', mixBlendMode: 'saturation' },
  sepia: { backgroundColor: '#A07A3C', mixBlendMode: 'multiply' },
  edgeTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  edgeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  edgeLeft: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  edgeRight: { position: 'absolute', top: 0, bottom: 0, right: 0 },
});
