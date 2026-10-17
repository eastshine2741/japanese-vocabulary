import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  frame: readonly [string, string, ...string[]];
  /** 세로 카드(곡)는 높이가 길고, 가로 카드(아티스트)는 폭이 길다. */
  landscape?: boolean;
  size?: number;
}

/** 카드 등급을 글자 옆에 찍는 작은 카드 모양. 실제 카드를 그리기엔 너무 작은 자리에 쓴다. */
function MaterialGlyph({ frame, landscape = false, size = 14 }: Props) {
  const long = Math.round(size * 1.4);
  const box = landscape ? { width: long, height: size } : { width: size, height: long };
  return (
    <View style={[styles.glyph, box, { borderRadius: size * 0.18 }]}>
      <LinearGradient colors={frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

export default React.memo(MaterialGlyph);

const styles = StyleSheet.create({
  glyph: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#00000026',
  },
});
