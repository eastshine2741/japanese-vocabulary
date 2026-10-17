import React, { useId, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';
import { guillochePath, rosettePath } from './artistFoilPaths';
import { CardTilt } from './useCardTilt';

// 웹(개발용)은 기울기를 따라가지 않고 비스듬한 빛에 멈춘 모습만 그린다. 앱은 ArtistFoil.native.tsx.
export interface FoilLayerProps {
  width: number;
  height: number;
  u: number;
  colors: readonly [string, string, ...string[]];
  tilt?: CardTilt;
}

function useSvgId() {
  return useId().replace(/[^a-zA-Z0-9]/g, '');
}

function stops(colors: readonly string[]) {
  return colors.map((c, i) => <Stop key={i} offset={i / (colors.length - 1)} stopColor={c} />);
}

export const RimLayer = React.memo(function RimLayer({ width, height, u, colors, rim }: FoilLayerProps & { rim: number }) {
  const id = useSvgId();
  const sw = rim * u;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={width} height={height}>
      <Defs>
        <LinearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={width} y2={height}>
          {stops(colors)}
        </LinearGradient>
      </Defs>
      <Rect x={sw / 2} y={sw / 2} width={width - sw} height={height - sw} rx={4 * u - sw / 2} fill="none" stroke={`url(#${id})`} strokeWidth={sw} />
      <Rect x={sw} y={sw} width={width - sw * 2} height={height - sw * 2} rx={4 * u - sw} fill="none" stroke="#00000066" strokeWidth={Math.max(0.5, 0.15 * u)} />
    </Svg>
  );
});

export const GuillocheLayer = React.memo(function GuillocheLayer({ width, height, u, colors, opacity }: FoilLayerProps & { opacity: number }) {
  const id = useSvgId();
  const top = height * 0.5;
  const d = useMemo(() => guillochePath(width, height, top), [width, height, top]);
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={width} height={height} opacity={opacity * 0.9}>
      <Defs>
        <LinearGradient id={`${id}f`} gradientUnits="userSpaceOnUse" x1={0} y1={top} x2={width} y2={height}>
          {stops(colors)}
        </LinearGradient>
        <LinearGradient id={`${id}m`} gradientUnits="userSpaceOnUse" x1={0} y1={top} x2={0} y2={top + (height - top) * 0.45}>
          <Stop offset={0} stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset={1} stopColor="#FFFFFF" stopOpacity={1} />
        </LinearGradient>
        <Mask id={`${id}k`}>
          <Rect x={0} y={0} width={width} height={height} fill={`url(#${id}m)`} />
        </Mask>
      </Defs>
      <Path d={d} fill="none" stroke={`url(#${id}f)`} strokeWidth={0.16 * u} mask={`url(#${id}k)`} />
    </Svg>
  );
});

export const RosetteLayer = React.memo(function RosetteLayer({ width, height, u, colors }: FoilLayerProps) {
  const id = useSvgId();
  const d = useMemo(() => rosettePath(width, height, width * 0.78, height * 0.32), [width, height]);
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={width} height={height}>
      <Defs>
        <LinearGradient id={id} gradientUnits="userSpaceOnUse" x1={-width * 0.2} y1={-height * 0.12} x2={width * 0.6} y2={height * 0.38}>
          {stops(colors)}
        </LinearGradient>
      </Defs>
      <Path d={d} fill="none" stroke={`url(#${id})`} strokeWidth={0.1 * u} />
    </Svg>
  );
});
