/** 굵은 글자 한 자의 대략 폭(em). 실제로 재지 않으므로 넉넉하게 잡는다. */
function charEm(ch: string): number {
  if (/[　-鿿가-힯]/.test(ch)) return 1;
  if (/[A-Z]/.test(ch)) return 0.78;
  if (/[0-9]/.test(ch)) return 0.62;
  if (ch === ' ') return 0.3;
  return 0.58;
}

export function textEm(text: string): number {
  return Array.from(text).reduce((sum, ch) => sum + charEm(ch), 0);
}

/** 가장 긴 글이 width 안에 한 줄로 들어가는 글자 크기. 모두 같은 크기로 써야 칸마다 들쭉날쭉하지 않다. */
export function fitFontSize(texts: readonly string[], width: number, max: number): number {
  const longest = Math.max(...texts.map(textEm));
  if (width <= 0 || longest <= 0) return max;
  return Math.min(max, Math.floor((width / longest) * 10) / 10);
}
