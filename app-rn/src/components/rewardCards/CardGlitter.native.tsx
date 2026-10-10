import React from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { CardTilt } from './useCardTilt';

// 가만히 들고 있어도 빛 방향이 천천히 돌아서 은은하게 반짝인다.
const IDLE_SWAY = 0.32;
const IDLE_PERIOD_MS = 7400;
// 잔 글리터 한 칸(dp)과, 큰 빛 반사가 들어갈 수 있는 칸 수(가로).
const FLAKE_CELL = 3.4;
const GLINT_COLUMNS = 5;

// 진짜 글리터처럼 조각마다 면의 기울기가 달라서, 빛이 그 면에 맞을 때만 번쩍인다.
// 보는 각도가 표면 위치마다 조금씩 달라서 반짝임이 띠처럼 흘러간다.
const GLITTER = Skia.RuntimeEffect.Make(`
uniform float2 size;
uniform float2 light;
uniform float strength;
uniform float cell;
uniform float glintCell;
uniform float seed;
uniform float rainbow;

float hash1(float2 p) { return fract(sin(dot(p + seed, float2(127.1, 311.7))) * 43758.5453); }
float2 hash2(float2 p) {
  return fract(sin(float2(dot(p + seed, float2(127.1, 311.7)), dot(p + seed, float2(269.5, 183.3)))) * 43758.5453);
}

float facet(float2 n, float2 l, float sigma) {
  float2 d = l - n;
  return exp(-dot(d, d) / (sigma * sigma));
}

float3 tint(float h) {
  float3 iri = 0.5 + 0.5 * cos(6.2831853 * (h + float3(0.0, 0.33, 0.67)));
  float3 gold = float3(1.0, 0.84, 0.52);
  return mix(mix(float3(1.0, 0.98, 0.93), gold, smoothstep(0.35, 0.75, h)), iri, 0.22);
}

float ray(float along, float across, float len, float thick) {
  return exp(-abs(across) / thick) * pow(max(0.0, 1.0 - abs(along) / len), 2.2);
}

half4 main(float2 p) {
  float2 l = light + (p / size - 0.5) * 0.9;

  float2 g = p / cell;
  float2 id = floor(g);
  float2 c = 0.2 + 0.6 * hash2(id);
  float r = mix(0.1, 0.4, pow(hash1(id + 3.0), 3.0));
  float d = length(fract(g) - c) / r;
  float core = exp(-d * d * 2.4);
  float hit = facet((hash2(id + 17.0) - 0.5) * 2.0, l, 0.28);
  // 은은하게 깔리는 바탕 반짝임은 일부 조각만 — 전부 켜면 격자처럼 보인다.
  float ambient = step(0.82, hash1(id + 23.0)) * 0.1;
  float3 col = tint(hash1(id + 9.0)) * core * (ambient + 2.0 * hit);

  float2 gg = p / glintCell;
  float2 gid = floor(gg);
  if (hash1(gid + 31.0) > 0.4) {
    float2 q = (fract(gg) - (0.45 + 0.1 * hash2(gid + 5.0))) * glintCell;
    float gh = facet((hash2(gid + 50.0) - 0.5) * 1.3, l, 0.17);
    float len = glintCell * 0.4;
    float2 qd = float2(q.x + q.y, q.x - q.y) * 0.70710678;
    float plus = ray(q.x, q.y, len, 0.55) + ray(q.y, q.x, len * 0.85, 0.55);
    float diag = (ray(qd.x, qd.y, len * 0.4, 0.4) + ray(qd.y, qd.x, len * 0.4, 0.4)) * 0.45;
    float bloom = exp(-dot(q, q) / (glintCell * glintCell * 0.0035));
    float3 gc = mix(float3(1.0), tint(hash1(gid + 13.0)), 0.4);
    col += gc * (plus + diag + bloom * 1.3) * gh * 1.5;
  }

  col *= strength;

  // 마스터 카드의 무지개 코팅: 보는 각도에 따라 간섭색 띠가 흐르고, 넓은 광택 띠에서만 진해진다.
  if (rainbow > 0.0) {
    float2 uv = p / size;
    float phase = uv.x * 0.8 + uv.y * 0.5 + light.x * 0.6 + light.y * 0.35;
    float3 iri = mix(float3(1.0), 0.5 + 0.5 * cos(6.2831853 * (phase * 1.4 + float3(0.0, 0.33, 0.67))), 0.6);
    float s = (uv.x - 0.5) * 0.8 - (uv.y - 0.5) * 0.5 - light.x * 0.55 - light.y * 0.3;
    float sheen = exp(-s * s / 0.045);
    float lines = 0.85 + 0.15 * sin((p.x + p.y) * 1.3);
    col += iri * rainbow * (0.06 + 0.26 * sheen) * lines;
  }

  float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  return half4(min(col, float3(a)), a);
}
`)!;

interface Props {
  seed: string;
  width: number;
  height: number;
  tilt: CardTilt;
  /** 0~1. 카드가 낡으면 반짝임도 같이 죽는다. */
  strength: number;
  /** 0~1. 마스터 카드만 무지개 코팅을 얹는다. */
  rainbow?: number;
}

function seedOf(text: string) {
  let s = 0;
  for (let i = 0; i < text.length; i++) s = (s * 31 + text.charCodeAt(i)) % 997;
  return s;
}

function CardGlitter({ seed, width, height, tilt, strength, rainbow = 0 }: Props) {
  const clock = useClock();
  const seedValue = seedOf(seed);
  const glintCell = width / GLINT_COLUMNS;
  const uniforms = useDerivedValue(() => {
    const t = (clock.value / IDLE_PERIOD_MS) * Math.PI * 2;
    return {
      size: [width, height],
      light: [tilt.x.value + Math.cos(t) * IDLE_SWAY, tilt.y.value + Math.sin(t * 2) * IDLE_SWAY * 0.6],
      strength,
      cell: FLAKE_CELL,
      glintCell,
      seed: seedValue,
      rainbow,
    };
  });

  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Fill>
        <Shader source={GLITTER} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}

export default React.memo(CardGlitter);
