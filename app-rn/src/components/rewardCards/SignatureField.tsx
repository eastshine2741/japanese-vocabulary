import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CardFonts } from './cardTheme';
import { CardSignature, SIGNATURE_BOX, SIGNATURE_CARD_STROKE, SIGNATURE_VIEW_BOX } from './signature';

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
  /** 밝은 바탕에 찍을 때의 라벨 색. 없으면 어두운 카드용 흰 글씨. */
  ink?: string;
}

const STRIP_W = 32;

/** 실물 카드 뒷면의 흰 서명 칸. 패드에 쓴 서명을 그대로 줄여 그린다. */
function SignatureField({ signature, fallbackName, hint, u, fonts, ink }: Props) {
  const width = STRIP_W * u;
  const height = (width * SIGNATURE_BOX.height) / SIGNATURE_BOX.width;
  const signed = !!signature && signature.length > 0;
  return (
    <View style={{ gap: 0.8 * u }}>
      <Text style={[styles.label, ink ? { color: `${ink}A6` } : null, { fontFamily: fonts.ko, fontSize: 2.4 * u, letterSpacing: 0.4 * u }]}>소유자 서명</Text>
      {/* 크림 종이 몸체에선 흰 칸이 묻혀서 테두리로 자리를 잡는다. */}
      <View style={[styles.strip, ink ? { borderWidth: StyleSheet.hairlineWidth, borderColor: `${ink}40` } : null, { width, height, borderRadius: 0.8 * u }]}>
        {/* SVG 는 비어 있어도 늘 붙여 둔다 — 서명 중에 새로 붙이면 Android 에서 그려지지 않는다. */}
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox={SIGNATURE_VIEW_BOX}>
          {signature?.map((d, i) => (
            <Path key={i} d={d} {...STROKE_PROPS} />
          ))}
        </Svg>
        {!signed && fallbackName ? (
          <Text
            style={[styles.name, { fontFamily: fonts.koBold, fontSize: 3.6 * u, paddingHorizontal: 1.8 * u }]}
            numberOfLines={1}
          >
            {fallbackName}
          </Text>
        ) : null}
        {hint && !signed ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: 0.8 * u, borderWidth: 0.5 * u, borderColor: hint, borderStyle: 'dashed' },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

export default React.memo(SignatureField);

const STROKE_PROPS = {
  stroke: SIGNATURE_INK,
  strokeWidth: SIGNATURE_CARD_STROKE,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

const styles = StyleSheet.create({
  label: { color: '#FFFFFF8C' },
  strip: { backgroundColor: SIGNATURE_PAPER, justifyContent: 'center', overflow: 'hidden' },
  name: { color: SIGNATURE_INK },
});
