import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Group, LinearGradient, Path, Rect, RoundedRect, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { guillochePath, rosettePath } from './artistFoilPaths';
import { CardTilt } from './useCardTilt';

export interface FoilLayerProps {
  width: number;
  height: number;
  u: number;
  colors: readonly [string, string, ...string[]];
  tilt?: CardTilt;
}

/** 메탈 카드 모서리. 기울이면 금속 결이 둘레를 따라 미끄러진다. */
export const RimLayer = React.memo(function RimLayer({ width, height, u, colors, tilt, rim }: FoilLayerProps & { rim: number }) {
  const sw = rim * u;
  const stops = useMemo(() => [...colors], [colors]);
  const start = useDerivedValue(() => {
    const s = (tilt?.x.value ?? -0.35) * 0.5 + (tilt?.y.value ?? -0.25) * 0.3;
    return { x: s * width, y: s * height };
  });
  const end = useDerivedValue(() => ({ x: start.value.x + width * 0.55, y: start.value.y + height * 0.55 }));
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <RoundedRect x={sw / 2} y={sw / 2} width={width - sw} height={height - sw} r={4 * u - sw / 2} style="stroke" strokeWidth={sw}>
        <LinearGradient start={start} end={end} colors={stops} mode="mirror" />
      </RoundedRect>
      {/* 안쪽 단차 그늘이 있어야 사진 위에 그은 선이 아니라 솟은 모서리로 읽힌다. */}
      <RoundedRect
        x={sw}
        y={sw}
        width={width - sw * 2}
        height={height - sw * 2}
        r={4 * u - sw}
        style="stroke"
        strokeWidth={Math.max(0.5, 0.15 * u)}
        color="#00000066"
      />
    </Canvas>
  );
});

/** 글씨 영역에 찍은 길로셰 박. 기울여 빛을 받을수록 선이 떠오른다. */
export const GuillocheLayer = React.memo(function GuillocheLayer({ width, height, u, colors, tilt, opacity }: FoilLayerProps & { opacity: number }) {
  const top = height * 0.5;
  const path = useMemo(() => Skia.Path.MakeFromSVGString(guillochePath(width, height, top)), [width, height, top]);
  const stops = useMemo(() => [...colors], [colors]);
  const start = useDerivedValue(() => ({ x: ((tilt?.x.value ?? -0.35) * 0.6 + 0.2) * width, y: top }));
  const end = useDerivedValue(() => ({ x: start.value.x + width * 0.5, y: height }));
  const alpha = useDerivedValue(
    () => opacity * (0.35 + Math.min(0.65, (Math.abs(tilt?.x.value ?? -0.35) + Math.abs(tilt?.y.value ?? -0.25)) * 0.9)),
  );
  if (!path) return null;
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Group layer opacity={alpha}>
        <Path path={path} style="stroke" strokeWidth={0.16 * u}>
          <LinearGradient start={start} end={end} colors={stops} mode="mirror" />
        </Path>
        <Rect x={0} y={0} width={width} height={height} blendMode="dstIn">
          <LinearGradient start={{ x: 0, y: top }} end={{ x: 0, y: top + (height - top) * 0.45 }} colors={['#00000000', '#000000']} />
        </Rect>
      </Group>
    </Canvas>
  );
});

/** 사진 전체에 깔린 로제트 홀로그램. 빛 띠가 닿은 결만 보이고, 기울이면 띠가 카드를 가로지른다. */
export const RosetteLayer = React.memo(function RosetteLayer({ width, height, u, colors, tilt }: FoilLayerProps) {
  const path = useMemo(() => Skia.Path.MakeFromSVGString(rosettePath(width, height, width * 0.78, height * 0.32)), [width, height]);
  const stops = useMemo(() => [...colors], [colors]);
  const start = useDerivedValue(() => ({
    x: ((tilt?.x.value ?? -0.35) * 0.9 + 0.5) * width - width * 0.4,
    y: (tilt?.y.value ?? -0.25) * 0.5 * height,
  }));
  const end = useDerivedValue(() => ({ x: start.value.x + width * 0.6, y: start.value.y + height * 0.38 }));
  if (!path) return null;
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Path path={path} style="stroke" strokeWidth={0.1 * u}>
        <LinearGradient start={start} end={end} colors={stops} mode="clamp" />
      </Path>
    </Canvas>
  );
});
