/**
 * 손가락이 지나간 자리로 봉투를 찢는 경로. trail 은 [x0, y0, x1, y1, …] 로 x 가 늘어나는 순서다.
 * tipX·tipY 는 지금 손가락 자리 — trail 중 tipX 를 넘은 점은 되돌아간 것이라 버린다.
 */

/** 찢긴 뒤 남는 몸통. tipX 오른쪽은 아직 붙어 있어 손가락 자리에서 위로 곧게 끊긴다. */
export function bodyPath(trail: readonly number[], tipX: number, tipY: number, w: number, h: number, r: number): string {
  'worklet';
  let d = `M0 ${trail[1]}`;
  for (let i = 2; i < trail.length; i += 2) {
    if (trail[i] >= tipX) break;
    d += `L${trail[i]} ${trail[i + 1]}`;
  }
  d += tipX < w - r ? `L${tipX} ${tipY}L${tipX} 0L${w - r} 0Q${w} 0 ${w} ${r}` : `L${w} ${tipY}`;
  return `${d}L${w} ${h - r}Q${w} ${h} ${w - r} ${h}L${r} ${h}Q0 ${h} 0 ${h - r}Z`;
}

/** 몸통에 드러난 찢긴 단면. */
export function edgePath(trail: readonly number[], tipX: number, tipY: number): string {
  'worklet';
  let d = `M0 ${trail[1]}`;
  for (let i = 2; i < trail.length; i += 2) {
    if (trail[i] >= tipX) break;
    d += `L${trail[i]} ${trail[i + 1]}`;
  }
  return `${d}L${tipX} ${tipY}`;
}

export interface Peel {
  /** 찢겨 나간 조각. */
  piece: string;
  /** 조각 쪽 찢긴 단면. */
  edge: string;
}

/** 찢겨 나간 윗조각. 손가락 자리를 축으로 angle(라디안)만큼 들리고 lift 만큼 떠오른다. */
export function peelPath(
  trail: readonly number[],
  tipX: number,
  tipY: number,
  r: number,
  angle: number,
  lift: number,
): Peel {
  'worklet';
  if (tipX < r) return { piece: 'M0 0', edge: 'M0 0' };
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const p = (x: number, y: number) => {
    const dx = x - tipX;
    const dy = y - tipY;
    return `${tipX + dx * cos - dy * sin} ${tipY + dx * sin + dy * cos - lift}`;
  };
  let last = 0;
  for (let i = 2; i < trail.length; i += 2) {
    if (trail[i] >= tipX) break;
    last = i;
  }
  let back = '';
  for (let i = last; i >= 2; i -= 2) back += `L${p(trail[i], trail[i + 1])}`;
  back += `L${p(0, trail[1])}`;
  const tip = p(tipX, tipY);
  return {
    piece: `M${p(0, r)}Q${p(0, 0)} ${p(r, 0)}L${p(tipX, 0)}L${tip}${back}Z`,
    edge: `M${tip}${back}`,
  };
}
