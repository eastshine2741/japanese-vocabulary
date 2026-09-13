import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';

interface Props {
  size?: number;
  color: string;
}

// Ionicons `search` geometry (512 viewBox) with the lens filled. Ionicons ships
// no filled magnifier — `search` and `search-outline` are the same outline — so
// the bottom tab draws this one for the selected state.
export default function SearchFilledIcon({ size = 20, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Circle cx={221.09} cy={221.09} r={157.09} fill={color} stroke={color} strokeWidth={32} />
      <Line x1={338.29} y1={338.29} x2={448} y2={448} stroke={color} strokeWidth={32} strokeLinecap="round" />
    </Svg>
  );
}
