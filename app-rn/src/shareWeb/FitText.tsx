import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

interface Props {
  text: string;
  style: StyleProp<TextStyle>;
  boxStyle?: StyleProp<ViewStyle>;
  /** 이보다 작아져야 한 줄에 든다면 이 크기로 두고 여러 줄로 꺾는다. */
  minFontSize?: number;
}

/**
 * 한 줄로 그리되 폭이 모자라면 글자를 줄인다. 웹엔 adjustsFontSizeToFit 이 없어 숨은 글자로 제 폭을 잰다.
 * 재는 글자는 계속 두어, 웹폰트가 늦게 바뀌어 폭이 달라져도 다시 맞춘다.
 */
function FitText({ text, style, boxStyle, minFontSize = 0 }: Props) {
  const [boxW, setBoxW] = useState(0);
  const [naturalW, setNaturalW] = useState(0);
  const handleBox = useCallback((e: LayoutChangeEvent) => setBoxW(e.nativeEvent.layout.width), []);
  const handleNatural = useCallback((e: LayoutChangeEvent) => setNaturalW(e.nativeEvent.layout.width), []);

  const flat = StyleSheet.flatten(style) ?? {};
  const base = flat.fontSize ?? 14;
  const fit = boxW && naturalW ? Math.min(1, boxW / naturalW) : 1;
  const wrap = base * fit < minFontSize;
  const scale = wrap ? minFontSize / base : fit;
  const fitted: TextStyle = {
    fontSize: base * scale,
    lineHeight: flat.lineHeight != null ? flat.lineHeight * scale : undefined,
    letterSpacing: flat.letterSpacing != null ? flat.letterSpacing * scale : undefined,
  };

  return (
    <View style={[styles.box, boxStyle]} onLayout={handleBox}>
      <View pointerEvents="none" style={styles.measure}>
        <Text style={style} numberOfLines={1} onLayout={handleNatural}>
          {text}
        </Text>
      </View>
      <Text style={[style, fitted, !(boxW && naturalW) && styles.hidden]} numberOfLines={wrap ? undefined : 1}>
        {text}
      </Text>
    </View>
  );
}

export default React.memo(FitText);

/** \n 으로 나눈 줄마다 따로 맞춘다. */
export const FitLines = React.memo(function FitLines({ text, style, boxStyle }: Props) {
  return (
    <>
      {text.split('\n').map((line) => (
        <FitText key={line} text={line} style={style} boxStyle={boxStyle} />
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', overflow: 'hidden' },
  measure: { position: 'absolute', left: 0, top: 0, width: 10000, alignItems: 'flex-start', opacity: 0 },
  hidden: { opacity: 0 },
});
