/** 서명 좌표계. 카드 서명 칸이 이 3:1 비율로 서명을 줄여 그린다. */
export const SIGNATURE_BOX = { width: 360, height: 120 } as const;
export const SIGNATURE_VIEW_BOX = `0 0 ${SIGNATURE_BOX.width} ${SIGNATURE_BOX.height}`;
export const SIGNATURE_STROKE = 3.2;
/** 카드 칸은 패드의 1/5 남짓으로 줄어들어 패드 굵기 그대로면 실선이 된다. 카드 위에서 펜 자국만큼 보이게 따로 굵게 그린다. */
export const SIGNATURE_CARD_STROKE = 8;

/** 획마다 SVG 경로 하나. */
export type CardSignature = string[];

export interface SignaturePoint {
  x: number;
  y: number;
}

/** 이보다 가까운 점은 버린다. 손 떨림이 경로를 부풀리지 않게. */
const MIN_STEP = 1.5;

const r = (n: number) => Math.round(n * 10) / 10;
const pt = (p: SignaturePoint) => `${r(p.x)} ${r(p.y)}`;

/** 패드 좌표를 서명 좌표계로 옮기고 칸 밖은 가장자리에 붙인다. */
export function toSignaturePoint(x: number, y: number, padWidth: number): SignaturePoint {
  const scale = SIGNATURE_BOX.width / padWidth;
  return {
    x: Math.min(Math.max(x * scale, 0), SIGNATURE_BOX.width),
    y: Math.min(Math.max(y * scale, 0), SIGNATURE_BOX.height),
  };
}

/** 획에 점을 더할지. 직전 점과 너무 가까우면 false. */
export function shouldAddPoint(points: SignaturePoint[], next: SignaturePoint): boolean {
  const last = points[points.length - 1];
  if (!last) return true;
  return Math.hypot(next.x - last.x, next.y - last.y) >= MIN_STEP;
}

/** 점들을 중점 기준 2차 곡선으로 이어 꺾임 없는 획으로 만든다. 점 하나는 둥근 끝이 보이게 아주 짧은 선. */
export function strokePath(points: SignaturePoint[]): string {
  if (points.length === 0) return '';
  const [first] = points;
  if (points.length === 1) return `M${pt(first)} L${r(first.x + 0.1)} ${r(first.y)}`;
  let d = `M${pt(first)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const n = points[i + 1];
    d += ` Q${pt(p)} ${pt({ x: (p.x + n.x) / 2, y: (p.y + n.y) / 2 })}`;
  }
  return `${d} L${pt(points[points.length - 1])}`;
}
