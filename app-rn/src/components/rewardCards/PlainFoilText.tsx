import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { CardTilt } from './useCardTilt';

export interface FoilTextProps {
  text: string;
  /** 박 그라데이션. 진한 색과 밝은 색이 번갈아야 금속으로 보인다. */
  colors: readonly [string, string, ...string[]];
  /** 자리 잡는 RN Text 의 글꼴. 박은 늘 Shippori ExtraBold 로 그리니 같은 글꼴을 넘긴다. */
  fontFamily: string;
  fontSize: number;
  lineHeight?: number;
  letterSpacing?: number;
  numberOfLines?: number;
  /** 없으면(카드 목록 썸네일) 박 없이 밝은 단색 글씨로만 그린다. 목록에서 카드마다 Skia 캔버스를 띄우면 무겁다. */
  tilt?: CardTilt;
  /** 사진 위에서 글자를 띄우는 그림자. */
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
}

// 박 없이 밝은 단색으로만 그린다. 웹(개발용)과 앱의 카드 목록 썸네일이 쓴다.
export function PlainFoilText({ text, colors, fontFamily, fontSize, lineHeight, letterSpacing, numberOfLines = 1, shadow, style }: FoilTextProps) {
  return (
    <View style={style}>
      <Text
        style={[
          { fontFamily, fontSize, lineHeight, letterSpacing, color: colors[2] ?? colors[1] },
          shadow && { textShadowColor: '#00000099', textShadowRadius: fontSize * 0.3 },
        ]}
        numberOfLines={numberOfLines}
      >
        {text}
      </Text>
    </View>
  );
}

