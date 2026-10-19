const r = (n: number) => Math.round(n * 10) / 10;

/** 지폐 길로셰처럼 위상이 서로 반대로 밀리는 두 물결 묶음을 겹친다. 엇갈리는 자리가 그물코가 된다. */
export function guillochePath(width: number, height: number, top: number): string {
  const lines = 9;
  const step = width / 90;
  const span = height - top;
  const amp = span * 0.16;
  let d = '';
  for (const dir of [1, -1]) {
    for (let i = 0; i < lines; i++) {
      const base = top + span * ((i + 0.5) / lines);
      const phase = dir * i * 0.55;
      for (let k = 0; k <= 90; k++) {
        const x = k * step;
        const t = (k / 90) * Math.PI * 2;
        const y = base + amp * Math.sin(t * 2 + phase) + amp * 0.45 * Math.sin(t * 5 - phase * 1.7);
        d += `${k === 0 ? 'M' : 'L'}${r(x)} ${r(y)}`;
      }
    }
  }
  return d;
}

/** 지폐 로제트처럼 한 점에서 퍼지는 물결 고리. 고리마다 물결 위상을 밀어 이웃 고리와 엇갈리는 결이 생긴다. */
export function rosettePath(width: number, height: number, cx: number, cy: number): string {
  const reach = Math.max(Math.hypot(cx, cy), Math.hypot(width - cx, cy), Math.hypot(cx, height - cy), Math.hypot(width - cx, height - cy));
  const rings = 18;
  const gap = reach / rings;
  const lobes = 28;
  const samples = 180;
  let d = '';
  for (let i = 1; i <= rings; i++) {
    const base = i * gap;
    const amp = gap * 0.55;
    const phase = i * 0.42;
    for (let k = 0; k <= samples; k++) {
      const a = (k / samples) * Math.PI * 2;
      const rr = base + amp * Math.sin(lobes * a + phase);
      d += `${k === 0 ? 'M' : 'L'}${r(cx + rr * Math.cos(a))} ${r(cy + rr * Math.sin(a))}`;
    }
  }
  return d;
}
