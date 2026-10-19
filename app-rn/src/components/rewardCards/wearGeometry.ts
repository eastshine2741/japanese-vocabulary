import { seededRandom } from './seededRandom';

type Pt = [number, number];

export interface WearCrease {
  ridge: string;
  /** 접힌 선의 그늘 쪽(살짝 어두운) 면. 모서리 접힘이면 들뜬 쪽(밝은) 면. */
  face: string;
  faceLight: boolean;
  /** 법선 방향 오프셋을 미리 적용한 그림자·하이라이트 선. */
  shadow: string;
  highlight: string;
  /** 잉크가 갈라져 판지가 드러난 마루 조각들. */
  cracks: string;
  opacity: number;
}

export interface WearStain {
  blob: string;
  ring: string;
  halo: string;
  opacity: number;
}

export interface WearPeel {
  d: string;
  lip: string;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface WearRip {
  gap: string;
  sideA: string;
  sideB: string;
  fibers: string;
  tape: { d: string; edges: string; shine: string };
  opacity: number;
}

export interface WearGeometry {
  /** 가장자리 잉크가 벗겨져 하얗게 일어난 테 (evenodd). */
  edge: string;
  /** edge 보다 두 배 깊게 번진 옅은 테. */
  edgeHaze: string;
  edgeOpacity: number;
  specks: { x: number; y: number; r: number; o: number }[];
  flakes: string;
  creases: WearCrease[];
  stain: WearStain | null;
  peels: WearPeel[];
  peelOpacity: number;
  rip: WearRip | null;
  scratch: number;
  grime: number;
}

export const ramp = (a: number, b: number, v: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));

const f = (n: number) => Math.round(n * 100) / 100;
const poly = (pts: Pt[], close = false) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('') + (close ? 'Z' : '');

/** 부드럽게 흔들리는 1D 노이즈 (-1~1). */
function wobble(rnd: () => number, n: number, smooth: number): number[] {
  const out: number[] = [];
  let v = 0;
  let target = rnd() * 2 - 1;
  for (let i = 0; i < n; i++) {
    if (i % smooth === 0) target = rnd() * 2 - 1;
    v += (target - v) * (1.6 / smooth);
    out.push(v);
  }
  return out;
}

function jitterLine(a: Pt, b: Pt, steps: number, amp: number, rnd: () => number): Pt[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const bend = (rnd() - 0.5) * len * 0.06;
  const w = wobble(rnd, steps + 1, 4);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const off = Math.sin(t * Math.PI) * bend + w[i] * amp;
    return [a[0] + dx * t + nx * off, a[1] + dy * t + ny * off] as Pt;
  });
}

function shift(pts: Pt[], d: number): Pt[] {
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = -(b[1] - a[1]) / len;
  const ny = (b[0] - a[0]) / len;
  return pts.map(([x, y]) => [x + nx * d, y + ny * d]);
}

function crease(pts: Pt[], facePts: Pt[], faceLight: boolean, u: number, opacity: number, rnd: () => number): WearCrease {
  let cracks = '';
  for (let i = 0; i < pts.length - 1; ) {
    const run = 1 + Math.floor(rnd() * 4);
    if (rnd() < 0.5) cracks += poly(pts.slice(i, Math.min(pts.length, i + run + 1)));
    // 마루에서 잔금이 비스듬히 갈라져 나간다.
    if (rnd() < 0.35) {
      const [x, y] = pts[i];
      const a = rnd() * Math.PI * 2;
      const l = (0.8 + rnd() * 1.8) * u;
      cracks += `M${f(x)} ${f(y)}L${f(x + Math.cos(a) * l)} ${f(y + Math.sin(a) * l)}`;
    }
    i += run;
  }
  return {
    ridge: poly(pts),
    face: poly(facePts, true),
    faceLight,
    shadow: poly(shift(pts, 0.55 * u)),
    highlight: poly(shift(pts, -0.45 * u)),
    cracks,
    opacity,
  };
}

/** 둥근 모서리 사각형 둘레를 따라 (점, 안쪽 법선, 모서리 근접도) 를 뽑는다. */
function perimeter(w: number, h: number, r: number, step: number) {
  const out: { p: Pt; n: Pt; corner: number }[] = [];
  const straight = (a: Pt, b: Pt, n: Pt) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s < len; s += step) {
      const t = s / len;
      const toEnd = Math.min(s, len - s);
      out.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], n, corner: Math.max(0, 1 - toEnd / (r * 2.2)) });
    }
  };
  const arc = (cx: number, cy: number, a0: number) => {
    const n = Math.ceil((Math.PI / 2) * r / step);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      out.push({ p: [cx + Math.cos(a) * r, cy + Math.sin(a) * r], n: [-Math.cos(a), -Math.sin(a)], corner: 1 });
    }
  };
  straight([r, 0], [w - r, 0], [0, 1]);
  arc(w - r, r, -Math.PI / 2);
  straight([w, r], [w, h - r], [-1, 0]);
  arc(w - r, h - r, 0);
  straight([w - r, h], [r, h], [0, -1]);
  arc(r, h - r, Math.PI / 2);
  straight([0, h - r], [0, r], [1, 0]);
  arc(r, r, Math.PI);
  return out;
}

function blob(cx: number, cy: number, rx: number, ry: number, rot: number, rough: number, rnd: () => number, n = 40): Pt[] {
  const w = wobble(rnd, n, 3);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + w[i] * rough + (rnd() - 0.5) * rough * 0.6;
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)] as Pt;
  });
}

const bbox = (pts: Pt[]) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

/**
 * age(0~1) 가 오를수록 단계적으로 손상이 붙는다: 잔흠집·빛바램 → 모서리 하얗게 일어남·얼룩·접힌 자국
 * → 모서리 접힘·코팅 벗겨짐 → 찢어져 테이프로 붙인 자국. 같은 시드는 늘 같은 자리에 같은 상처가 난다.
 * 모든 좌표는 앞면 기준이다.
 */
export type CardSide = 'front' | 'back';

export function wearGeometry(seed: string, width: number, height: number, age: number, side: CardSide = 'front'): WearGeometry {
  // 가장자리·접힘·찢어짐은 종이 자체의 손상이라 앞뒤가 같은 시드를 쓴다 (뒷면은 렌더 때 좌우 반전).
  // 얼룩·코팅 벗겨짐은 한쪽 면에만 생기므로 면마다 따로 뽑는다.
  // 손상마다 난수 흐름을 따로 둔다 — 하나를 나눠 쓰면 age 따라 앞에서 뽑는 횟수가 바뀌어 뒤 손상의 자리가 움직인다.
  const stream = (name: string) => seededRandom(`${seed}-wear-${name}`);
  const rnd = stream('edge');
  const u = width / 100;
  const edgeAmt = ramp(0.05, 0.75, age);

  // 가장자리: 평소엔 얇게, 군데군데 이가 빠지고, 모서리는 둥글게 닳는다.
  const per = perimeter(width, height, 4.6 * u, 0.7 * u);
  const wob = wobble(rnd, per.length, 9);
  // 둘레 전체가 고르게 닳지 않고, 손이 자주 닿는 구간만 두드러지게 닳는다.
  const zone = wobble(rnd, per.length, 40);
  let chip = 0;
  let chipLen = 1;
  let chipDepth = 0;
  const inner: Pt[] = per.map(({ p, n, corner }, i) => {
    // 점마다 같은 수만큼 뽑아야 age 가 바뀌어도 이 빠진 자리가 그대로다.
    const [chipR, lenR, depthR, cornerR, jitterR] = [rnd(), rnd(), rnd(), rnd(), rnd()];
    if (chip <= 0 && chipR < 0.02 + edgeAmt * 0.03) {
      chipLen = 4 + Math.floor(lenR * 8);
      chip = chipLen;
      chipDepth = (0.8 + depthR * 2) * u;
    }
    const chipNow = chip-- > 0 ? chipDepth * Math.sin(((chipLen - chip) / (chipLen + 1)) * Math.PI) : 0;
    const worn = Math.max(0, zone[i] * 1.6 - 0.2);
    const depth = edgeAmt * (
      (0.12 + (wob[i] * 0.5 + 0.5) * 0.3 + worn * 1.4) * u
      + chipNow
      + corner * corner * (1.6 + cornerR * 3) * u
      + (jitterR - 0.5) * 0.3 * u
    );
    return [p[0] + n[0] * Math.max(0, depth), p[1] + n[1] * Math.max(0, depth)];
  });
  const rect = `M0 0H${f(width)}V${f(height)}H0Z`;
  const edge = rect + poly(inner, true);
  const haze = per.map(({ p }, i) => {
    const [x, y] = inner[i];
    return [p[0] + (x - p[0]) * 2.2, p[1] + (y - p[1]) * 2.2] as Pt;
  });
  const edgeHaze = rect + poly(haze, true);

  const speckRnd = stream('specks');
  const specks = Array.from({ length: Math.round(160 * edgeAmt) }, () => {
    const { p, n, corner } = per[Math.floor(speckRnd() * per.length)];
    const d = (1 + speckRnd() * 3 + corner * 3) * u * edgeAmt;
    return { x: p[0] + n[0] * d, y: p[1] + n[1] * d, r: (0.12 + speckRnd() * 0.32) * u, o: 0.4 + speckRnd() * 0.5 };
  });

  let flakes = '';
  const flakeRnd = stream('flakes');
  const flakeCount = Math.round(18 * ramp(0.35, 1, age));
  for (let i = 0; i < flakeCount; i++) {
    const { p, n } = per[Math.floor(flakeRnd() * per.length)];
    const d = (2 + flakeRnd() * 9) * u;
    flakes += poly(
      blob(p[0] + n[0] * d, p[1] + n[1] * d, (0.4 + flakeRnd()) * u, (0.3 + flakeRnd() * 0.6) * u, flakeRnd() * 3, 0.5, flakeRnd, 9),
      true,
    );
  }

  // 접힌 자국: 가로로 한 번 → 모서리 하나가 접힘 → 세로로 한 번 더.
  const creases: WearCrease[] = [];
  const c1 = ramp(0.28, 0.48, age);
  const cornerAmt = ramp(0.45, 0.65, age);
  const c2 = ramp(0.6, 0.8, age);
  const creaseRnd = stream('crease');
  const y1 = height * (0.3 + creaseRnd() * 0.45);
  const y2 = y1 + (creaseRnd() - 0.5) * height * 0.18;
  const across = jitterLine([-2, y1], [width + 2, y2], 36, 0.35 * u, creaseRnd);
  const x1 = width * (0.3 + creaseRnd() * 0.4);
  const x2 = x1 + (creaseRnd() - 0.5) * width * 0.25;
  const down = jitterLine([x1, -2], [x2, height + 2], 44, 0.35 * u, creaseRnd);
  const corner = Math.floor(creaseRnd() * 4);
  const cs = (14 + creaseRnd() * 9) * u;
  const cornerXY: Pt = [corner % 2 ? width : 0, corner < 2 ? 0 : height];
  const ca: Pt = [cornerXY[0] === 0 ? cs : width - cs, cornerXY[1]];
  const cb: Pt = [cornerXY[0], cornerXY[1] === 0 ? cs * 0.9 : height - cs * 0.9];
  const cornerLine = jitterLine(ca, cb, 14, 0.2 * u, creaseRnd);
  if (c1 > 0) creases.push(crease(across, [...across, [width + 2, -2], [-2, -2]], false, u, c1, stream('crease-across')));
  if (cornerAmt > 0) creases.push(crease(cornerLine, [...cornerLine, cornerXY], true, u, cornerAmt, stream('crease-corner')));
  if (c2 > 0) creases.push(crease(down, [...down, [-2, height + 2], [-2, -2]], false, u, c2, stream('crease-down')));

  const stainAmt = ramp(0.3, 0.55, age);
  let stain: WearStain | null = null;
  if (stainAmt > 0) {
    const srnd = stream(`stain-${side}`);
    const cx = width * (0.2 + srnd() * 0.6);
    const cy = height * (0.15 + srnd() * 0.7);
    const r = (9 + srnd() * 7) * u;
    const ring = blob(cx, cy, r, r * (0.9 + srnd() * 0.15), srnd() * 3, 0.07, srnd, 60);
    const start = Math.floor(srnd() * 60);
    const span = 42 + Math.floor(srnd() * 18);
    const open = Array.from({ length: span }, (_, i) => ring[(start + i) % 60]);
    const halo = blob(cx + 1.5 * u, cy - 1 * u, r * 0.82, r * 0.8, srnd() * 3, 0.1, srnd, 48).slice(0, 30 + Math.floor(srnd() * 15));
    stain = { blob: poly(ring, true), ring: poly(open), halo: poly(halo), opacity: stainAmt };
  }

  const peelOpacity = ramp(0.6, 0.78, age);
  const peels: WearPeel[] = [];
  const peelCount = age > 0.85 ? 2 : peelOpacity > 0 ? 1 : 0;
  const prnd = stream(`peel-${side}`);
  for (let i = 0; i < peelCount; i++) {
    const { p, n } = per[Math.floor(prnd() * per.length)];
    const d = (4 + prnd() * 4) * u;
    const rot = Math.atan2(n[1], n[0]) + Math.PI / 2;
    const pts = blob(p[0] + n[0] * d, p[1] + n[1] * d, (9 + prnd() * 7) * u, (4.5 + prnd() * 3) * u, rot, 0.3, prnd, 52);
    peels.push({ d: poly(pts, true), lip: poly(pts.map(([x, y]) => [x - n[0] * 0.4 * u, y - n[1] * 0.4 * u] as Pt), true), bbox: bbox(pts) });
  }

  const ripAmt = ramp(0.8, 0.92, age);
  let rip: WearRip | null = null;
  if (ripAmt > 0) {
    const ripRnd = stream('rip');
    const fromLeft = ripRnd() < 0.5;
    const y0 = height * (0.55 + ripRnd() * 0.3);
    const dir = (fromLeft ? 0 : Math.PI) + (ripRnd() - 0.5) * 0.7;
    const len = (26 + ripRnd() * 10) * u;
    const steps = 26;
    const spine: Pt[] = [];
    let [x, y] = [fromLeft ? -1 : width + 1, y0];
    let a = dir;
    for (let i = 0; i <= steps; i++) {
      spine.push([x + (i % 2 ? 1 : -1) * (0.15 + ripRnd() * 0.45) * u, y + (ripRnd() - 0.5) * 0.5 * u]);
      a += (ripRnd() - 0.5) * 0.35;
      x += Math.cos(a) * (len / steps);
      y += Math.sin(a) * (len / steps);
    }
    const nx = -Math.sin(dir);
    const ny = Math.cos(dir);
    const gapAt = (i: number) => Math.pow(1 - i / steps, 0.7) * (1.2 + ripRnd() * 1.2) * u;
    const sideA = spine.map(([px, py], i) => [px + nx * gapAt(i) / 2, py + ny * gapAt(i) / 2] as Pt);
    const sideB = spine.map(([px, py], i) => [px - nx * gapAt(i) / 2, py - ny * gapAt(i) / 2] as Pt);
    let fibers = '';
    for (const [px, py] of [...sideA, ...sideB]) {
      if (ripRnd() < 0.55) continue;
      const fa = ripRnd() * Math.PI * 2;
      const fl = (0.3 + ripRnd() * 0.8) * u;
      fibers += `M${f(px)} ${f(py)}L${f(px + Math.cos(fa) * fl)} ${f(py + Math.sin(fa) * fl)}`;
    }

    // 찢어진 자리 가운데를 누렇게 바랜 테이프 한 조각이 가로지른다.
    const mid = spine[Math.floor(steps * (0.35 + ripRnd() * 0.25))];
    const ta = dir + Math.PI / 2 + (ripRnd() - 0.5) * 0.5;
    const tl = (24 + ripRnd() * 8) * u;
    const tw = (8 + ripRnd() * 2) * u;
    const along: Pt = [Math.cos(ta), Math.sin(ta)];
    const side: Pt = [-along[1], along[0]];
    const at = (s: number, t: number): Pt => [mid[0] + along[0] * s + side[0] * t, mid[1] + along[1] * s + side[1] * t];
    const teeth = 6;
    const end = (s: number, sign: number) =>
      Array.from({ length: teeth + 1 }, (_, i) => at(s + sign * (i % 2 ? 0.7 : 0) * u + (ripRnd() - 0.5) * 0.4 * u, tw / 2 - (i / teeth) * tw));
    const a1 = end(tl / 2, 1);
    const b1 = end(-tl / 2, -1).reverse();
    const tape = poly([...a1, ...b1], true);
    const edges = poly([at(-tl / 2, tw / 2), at(tl / 2, tw / 2)]) + poly([at(-tl / 2, -tw / 2), at(tl / 2, -tw / 2)]);
    const shine = poly([at(-tl / 2 + 2 * u, tw / 2 - 2 * u), at(tl / 2 - 2 * u, tw / 2 - 1.6 * u)]);
    rip = {
      gap: poly([...sideA, ...sideB.slice().reverse()], true),
      sideA: poly(sideA),
      sideB: poly(sideB),
      fibers,
      tape: { d: tape, edges, shine },
      opacity: ripAmt,
    };
  }

  return {
    edge,
    edgeHaze,
    edgeOpacity: edgeAmt,
    specks,
    flakes,
    creases,
    stain,
    peels,
    peelOpacity,
    rip,
    scratch: ramp(0, 0.4, age),
    grime: ramp(0.1, 0.95, age),
  };
}
