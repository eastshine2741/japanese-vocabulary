import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { MASTER_PIP } from './cardTheme';
import { CardLevel } from './types';
import { CardTilt } from './useCardTilt';

interface Props {
  level: CardLevel;
  size: number;
  tilt?: CardTilt;
}

const BEVEL = ['#E4F5FF', MASTER_PIP, '#2F7FD0', '#173F86'] as const;
const TABLE = ['#2F7FD0', MASTER_PIP, '#F2FAFF'] as const;

/** 마스터 카드 표면에 양각으로 찍은 푸른 다이아. 렌티큘러 인쇄 위에 얹혀 두 장면 모두에서 보인다. */
function MasterPips({ level, size, tilt }: Props) {
  return (
    <View style={[styles.row, { gap: size * 0.75 }]}>
      {[0, 1, 2].map((i) => (
        <Pip key={i} index={i} filled={i < level} size={size} tilt={tilt} />
      ))}
    </View>
  );
}

export default React.memo(MasterPips);

function Pip({ index, filled, size, tilt }: { index: number; filled: boolean; size: number; tilt?: CardTilt }) {
  const lift = Math.max(0.5, size * 0.12);
  // 기울이면 다이아마다 다른 각도에서 빛을 받아 하나씩 번쩍인다.
  const peak = -0.3 + index * 0.3;
  const shine = useAnimatedStyle(() => {
    const t = tilt ? tilt.x.value + tilt.y.value * 0.5 : -0.35;
    const d = Math.abs(t - peak);
    return { opacity: tilt ? Math.max(0, 1 - d / 0.2) : 0 };
  });
  const sheen = useAnimatedStyle(() => {
    const t = tilt ? tilt.x.value + tilt.y.value * 0.5 : -0.35;
    return { opacity: 0.12 + 0.6 * Math.max(0, 1 - Math.abs(t - peak) / 0.45) };
  });

  const box = { width: size, height: size };
  if (!filled) {
    return <View style={[styles.diamond, box, { borderWidth: Math.max(1, size * 0.16), borderColor: `${MASTER_PIP}88` }]} />;
  }
  const table = size * 0.46;
  const glint = size * 2.4;
  return (
    <View style={box}>
      <View style={[styles.diamond, styles.abs, box, styles.shadow, { left: lift, top: lift }]} />
      <View style={[styles.diamond, styles.abs, box, styles.highlight, { left: -lift * 0.6, top: -lift * 0.6 }]} />
      <View style={[styles.diamond, styles.abs, box, styles.clip]}>
        <LinearGradient colors={BEVEL} locations={[0, 0.35, 0.7, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.abs, { width: table, height: table, left: (size - table) / 2, top: (size - table) / 2 }]}>
          <LinearGradient colors={TABLE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.sheen, sheen]} />
        </View>
      </View>
      <Animated.View
        pointerEvents="none"
        style={[styles.abs, styles.glint, { width: glint, height: glint, left: (size - glint) / 2, top: (size - glint) / 2 }, shine]}
      >
        <View style={[styles.ray, { width: glint, height: Math.max(0.6, size * 0.1) }]} />
        <View style={[styles.ray, { width: Math.max(0.6, size * 0.1), height: glint }]} />
        <View style={[styles.core, { width: size * 0.32, height: size * 0.32, borderRadius: size }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  abs: { position: 'absolute' },
  diamond: { transform: [{ rotate: '45deg' }] },
  clip: { overflow: 'hidden', left: 0, top: 0 },
  shadow: { backgroundColor: '#04122CB3' },
  highlight: { backgroundColor: '#FFFFFF8C' },
  sheen: { backgroundColor: '#FFFFFF' },
  glint: { alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', backgroundColor: '#FFFFFFE6', borderRadius: 1 },
  core: { backgroundColor: '#FFFFFF', boxShadow: '0 0 3px 1px rgba(190, 230, 255, 0.95)' },
});
