import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Fill, ImageShader, LinearGradient, Shader, SkImage, Skia, makeImageFromView, useImage, vec } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { LENTICULAR_ART_SCALE, LenticularProps, LenticularText } from './LenticularScene';
import { useArtColors } from './artColors';
import { CardTilt } from './useCardTilt';

// 렌즈 한 줄의 폭(dp). 더 좁히면 2x 화면에서 한 줄이 2px 아래로 내려가 물결무늬(모아레)가 생긴다.
const LENS_PITCH = 1.2;

// 아트의 밝기만 남겨 ink → accent → 흰빛 두 색 인쇄로 칠한다. 플랫폼마다 다르게 그리는 mixBlendMode 대신 셰이더가 직접 섞는다.
// 렌즈마다 넘어가는 각도가 조금씩 달라서, 기울이면 장면이 왼쪽부터 쓸려 바뀐다.
const LENTICULAR = Skia.RuntimeEffect.Make(`
uniform shader art;
uniform shader text;
uniform float width;
uniform float height;
uniform float pitch;
uniform float tiltX;
uniform float3 ink;
uniform float3 accent;

half4 main(float2 p) {
  float reveal = clamp((tiltX - 0.05 - (p.x / width) * 0.3) / 0.16, 0.0, 1.0);
  if (reveal <= 0.0) return half4(0.0);
  float lum = dot(float3(art.eval(p).rgb), float3(0.2126, 0.7152, 0.0722));
  float3 c = lum < 0.5 ? mix(ink, accent, smoothstep(0.0, 0.5, lum)) : mix(accent, float3(1.0), (lum - 0.5) * 1.1);
  // 위 세로 가사·아래 번역 자리를 ink 로 눌러 흰 글씨를 받친다.
  float y = p.y / height;
  c = mix(c, ink, 0.6 * (1.0 - smoothstep(0.0, 0.45, y)) + 0.85 * smoothstep(0.45, 1.0, y));
  half4 t = text.eval(p);
  half4 scene = half4(t.rgb + half3(c) * (1.0 - t.a), 1.0);
  if (reveal >= 1.0) return scene;
  float phase = fract(p.x / pitch);
  float aa = 0.6 / pitch;
  return scene * (1.0 - smoothstep(reveal - aa, reveal + aa, phase));
}
`)!;

const rgb = (hex: string) => Array.from(Skia.Color(hex)).slice(0, 3);

/**
 * 글씨는 RN 뷰로 한 번 그려 이미지로 떠 두고, 셰이더가 칠한 아트 위에 얹어 렌즈 줄마다 앞면과 섞는다.
 * 글씨 뷰는 카드 맨 아래(zIndex -1)에 깔려 가려진 채로 캡처만 된다.
 */
export default function LenticularLayer({ tilt, ...scene }: LenticularProps & { tilt: CardTilt }) {
  // 견본 카드는 회색 강조색이라 아트에서 색을 뽑아 칠한다.
  const card = useArtColors(scene.card, scene.card.artworkUrl) ?? scene.card;
  const art = useImage(scene.card.artworkUrl || null);
  const textRef = useRef<View>(null);
  const [laidOut, setLaidOut] = useState(false);
  const [text, setText] = useState<SkImage | null>(null);
  const handleLayout = useCallback(() => setLaidOut(true), []);

  useEffect(() => {
    if (!laidOut) return;
    let cancelled = false;
    // 레이아웃·폰트가 화면에 반영된 다음 프레임에 뜬다.
    const frame = requestAnimationFrame(() => {
      makeImageFromView(textRef).then((img) => {
        if (!cancelled && img) setText(img);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [laidOut, scene.fonts.jpHeavy, scene.fonts.ko, card.id, card.lyric, card.ink, scene.width]);

  const ink = useMemo(() => rgb(card.ink), [card.ink]);
  const accent = useMemo(() => rgb(card.accent), [card.accent]);
  const uniforms = useDerivedValue(() => ({
    width: scene.width,
    height: scene.height,
    pitch: LENS_PITCH,
    tiltX: tilt.x.value,
    ink,
    accent,
  }));
  const artW = scene.width * LENTICULAR_ART_SCALE;
  const artH = scene.height * LENTICULAR_ART_SCALE;
  const rect = { width: scene.width, height: scene.height, x: 0, y: 0 };

  return (
    <>
      <View pointerEvents="none" style={styles.under}>
        <LenticularText ref={textRef} {...scene} card={card} onLayout={handleLayout} />
      </View>
      {text && (
        <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={LENTICULAR} uniforms={uniforms}>
              {art ? (
                <ImageShader
                  image={art}
                  fit="cover"
                  rect={{ x: (scene.width - artW) / 2, y: (scene.height - artH) / 2, width: artW, height: artH }}
                />
              ) : (
                <LinearGradient start={vec(0, 0)} end={vec(0, scene.height)} colors={['#FFFFFF', '#000000']} />
              )}
              <ImageShader image={text} fit="fill" rect={rect} />
            </Shader>
          </Fill>
        </Canvas>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  under: { ...StyleSheet.absoluteFillObject, zIndex: -1 },
});
