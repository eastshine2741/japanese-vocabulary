import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color: string;
}

// lucide `message-square-warning` (ISC). Feather 에 없는 모양이라 직접 그린다 — 어드민 제보 메뉴와 같은 아이콘.
export default function ReportIcon({ size = 16, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <Path d="M12 7v2" />
      <Path d="M12 13h.01" />
    </Svg>
  );
}
