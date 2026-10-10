import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CardFonts } from './cardTheme';
import { CardSignature, SIGNATURE_BOX, SIGNATURE_STROKE, SIGNATURE_VIEW_BOX } from './signature';

export const SIGNATURE_PAPER = '#F3EFE6';
export const SIGNATURE_INK = '#1D2140';

interface Props {
  signature: CardSignature | null;
  /** 서명 없이 발급된 카드는 이름을 대신 찍는다. 없으면 빈 칸. */
  fallbackName?: string;
  /** 서명할 자리를 이 색 점선으로 표시한다. 빈 칸일 때만. */
  hint?: string;
  /** 카드 폭의 1/100. */
  u: number;
  fonts: CardFonts;
}

const STRIP_W = 40;

/** 실물 카드 뒷면의 흰 서명 칸. 패드에 쓴 서명을 그대로 줄여 그린다. */
function SignatureField({ signature, fallbackName, hint, u, fonts }: Props) {
  const width = STRIP_W * u;
  const height = (width * SIGNATURE_BOX.height) / SIGNATURE_BOX.width;
  return (
    <View style={{ gap: 0.8 * u }}>
      <Text style={[styles.label, { fontFamily: fonts.ko, fontSize: 2.4 * u, letterSpacing: 0.4 * u }]}>소유자 서명</Text>
      <View
        style={[
          styles.strip,
          { width, height, borderRadius: 0.8 * u },
          hint && !signature?.length ? { borderWidth: 0.5 * u, borderColor: hint, borderStyle: 'dashed' } : null,
        ]}
      >
        {signature && signature.length > 0 ? (
          <Svg width={width} height={height} viewBox={SIGNATURE_VIEW_BOX}>
            {signature.map((d, i) => (
              <Path key={i} d={d} {...STROKE_PROPS} />
            ))}
          </Svg>
        ) : fallbackName ? (
          <Text
            style={[styles.name, { fontFamily: fonts.koBold, fontSize: 3.6 * u, paddingHorizontal: 1.8 * u }]}
            numberOfLines={1}
          >
            {fallbackName}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default React.memo(SignatureField);

const STROKE_PROPS = {
  stroke: SIGNATURE_INK,
  strokeWidth: SIGNATURE_STROKE,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

const styles = StyleSheet.create({
  label: { color: '#FFFFFF8C' },
  strip: { backgroundColor: SIGNATURE_PAPER, justifyContent: 'center', overflow: 'hidden' },
  name: { color: SIGNATURE_INK },
});
