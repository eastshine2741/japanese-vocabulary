import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Fill, ImageShader, Shader, SkImage, Skia, makeImageFromView } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import LenticularScene, { LenticularProps } from './LenticularScene';
import { CardTilt } from './useCardTilt';

// 렌즈 한 줄의 폭(dp). 더 좁히면 2x 화면에서 한 줄이 2px 아래로 내려가 물결무늬(모아레)가 생긴다.
const LENS_PITCH = 1.2;

// 렌즈마다 넘어가는 각도가 조금씩 달라서, 기울이면 장면이 왼쪽부터 쓸려 바뀐다.
const LENTICULAR = Skia.RuntimeEffect.Make(`
uniform shader scene;
uniform float width;
uniform float pitch;
uniform float tiltX;

half4 main(float2 p) {
  float reveal = clamp((tiltX - 0.05 - (p.x / width) * 0.3) / 0.16, 0.0, 1.0);
  if (reveal <= 0.0) return half4(0.0);
  half4 c = scene.eval(p);
  if (reveal >= 1.0) return c;
  float phase = fract(p.x / pitch);
  float aa = 0.6 / pitch;
  return c * (1.0 - smoothstep(reveal - aa, reveal + aa, phase));
}
`)!;

/**
 * 장면을 RN 뷰로 한 번 그려 이미지로 떠 두고, 셰이더가 렌즈 줄마다 앞면과 섞는다.
 * 장면 뷰는 카드 맨 아래(zIndex -1)에 깔려 가려진 채로 캡처만 된다.
 */
export default function LenticularLayer({ tilt, ...scene }: LenticularProps & { tilt: CardTilt }) {
  const sceneRef = useRef<View>(null);
  const [loaded, setLoaded] = useState(false);
  const [image, setImage] = useState<SkImage | null>(null);
  const handleReady = useCallback(() => setLoaded(true), []);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    // 레이아웃·폰트가 화면에 반영된 다음 프레임에 뜬다.
    const frame = requestAnimationFrame(() => {
      makeImageFromView(sceneRef).then((img) => {
        if (!cancelled && img) setImage(img);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [loaded, scene.mincho.extraBold, scene.card.id, scene.width]);

  const uniforms = useDerivedValue(() => ({ width: scene.width, pitch: LENS_PITCH, tiltX: tilt.x.value }));

  return (
    <>
      <View pointerEvents="none" style={styles.under}>
        <LenticularScene ref={sceneRef} {...scene} onReady={handleReady} />
      </View>
      {image && (
        <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={LENTICULAR} uniforms={uniforms}>
              <ImageShader image={image} fit="fill" rect={{ x: 0, y: 0, width: scene.width, height: scene.height }} />
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
