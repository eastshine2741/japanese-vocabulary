import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Blur, Canvas, Group, LinearGradient, Paint, Paragraph, Rect, Skia, SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { ShipporiMinchoB1_800ExtraBold } from '@expo-google-fonts/shippori-mincho-b1';
import { FoilTextProps, PlainFoilText } from './PlainFoilText';

// 폰트 파일이 15MB 라 Skia useFonts 처럼 글자마다 읽으면 카드 목록에서 메모리가 터진다. 앱 전체에서 한 번만 읽는다.
let foilFontMgr: SkTypefaceFontProvider | null = null;
let foilFontLoad: Promise<SkTypefaceFontProvider | null> | null = null;

function loadFoilFont() {
  foilFontLoad ??= Skia.Data.fromURI(Image.resolveAssetSource(ShipporiMinchoB1_800ExtraBold).uri)
    .then((data) => {
      const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
      if (!typeface) return null;
      const mgr = Skia.TypefaceFontProvider.Make();
      mgr.registerFont(typeface, 'Foil');
      foilFontMgr = mgr;
      return mgr;
    })
    .catch(() => null);
  return foilFontLoad;
}

function useFoilFont() {
  const [mgr, setMgr] = useState(foilFontMgr);
  useEffect(() => {
    if (mgr) return;
    let alive = true;
    loadFoilFont().then((m) => alive && setMgr(m));
    return () => {
      alive = false;
    };
  }, [mgr]);
  return mgr;
}

// RN Text 엔 그라데이션 글자가 없어 Skia 로 그린다. 자리는 투명한 RN Text 가 잡고, 그 위에 같은 글자를 박으로 덮는다.
function FoilText(props: FoilTextProps) {
  return props.tilt ? <SkiaFoilText {...props} /> : <PlainFoilText {...props} />;
}

function SkiaFoilText({ text, colors, fontFamily, fontSize, lineHeight = fontSize * 1.2, letterSpacing = 0, numberOfLines = 1, tilt, shadow, style }: FoilTextProps) {
  const fontMgr = useFoilFont();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setBox((b) => (b && b.w === w && b.h === h ? b : { w, h }));
  }, []);

  // 한 줄 글자는 RN 과 Skia 의 폭 계산이 조금 달라 말줄임이 생기지 않게 여유를 둔다.
  const layoutW = box ? box.w + (numberOfLines === 1 ? fontSize : 1) : 0;
  const [face, ink] = useMemo(() => {
    if (!fontMgr || !box) return [null, null];
    const make = (color: string) => {
      const p = Skia.ParagraphBuilder.Make({ maxLines: numberOfLines, ellipsis: '…' }, fontMgr)
        .pushStyle({
          color: Skia.Color(color),
          fontFamilies: ['Foil'],
          fontSize,
          heightMultiplier: lineHeight / fontSize,
          halfLeading: true,
          letterSpacing,
        })
        .addText(text)
        .build();
      p.layout(layoutW);
      return p;
    };
    return [make('#FFFFFF'), shadow ? make('#000000') : null];
  }, [fontMgr, box, layoutW, text, fontSize, lineHeight, letterSpacing, numberOfLines, shadow]);

  const stops = useMemo(() => [...colors], [colors]);
  const pad = fontSize * 0.6;
  const w = layoutW + pad * 2;
  const h = (box?.h ?? 0) + pad * 2;
  // 기울이면 박의 밝은 띠가 글자 위를 미끄러진다.
  const start = useDerivedValue(() => ({ x: pad + (tilt?.x.value ?? -0.35) * w * 0.45, y: pad }));
  const end = useDerivedValue(() => ({ x: start.value.x + Math.max(w * 0.7, fontSize * 6), y: h - pad }));

  return (
    <View style={style} onLayout={onLayout}>
      {/* Android 는 color 'transparent'(0)를 색 없음으로 보고 기본 검정으로 그려, Skia 글자와 폭이 다른 검은 글씨가 그림자처럼 비친다. */}
      <Text
        style={{ fontFamily, fontSize, lineHeight, letterSpacing, color: colors[1], opacity: face ? 0 : 1 }}
        numberOfLines={numberOfLines}
      >
        {text}
      </Text>
      {face && (
        <Canvas pointerEvents="none" style={[styles.canvas, { left: -pad, top: -pad, width: w, height: h }]}>
          {ink && (
            <Group opacity={0.6} layer={<Paint><Blur blur={fontSize * 0.18} /></Paint>}>
              <Paragraph paragraph={ink} x={pad} y={pad} width={layoutW} />
            </Group>
          )}
          <Group layer>
            <Paragraph paragraph={face} x={pad} y={pad} width={layoutW} />
            <Rect x={0} y={0} width={w} height={h} blendMode="srcIn">
              <LinearGradient start={start} end={end} colors={stops} mode="mirror" />
            </Rect>
          </Group>
        </Canvas>
      )}
    </View>
  );
}

export default React.memo(FoilText);

const styles = StyleSheet.create({
  canvas: { position: 'absolute' },
});
