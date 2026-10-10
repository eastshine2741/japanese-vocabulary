import { CardLyricLine } from './types';

/** 카드 한 장에 들어가는 가사 줄 수. 앞면 세로쓰기 두 단이 아트 폭의 한계다. */
export const MAX_LYRIC_LINES = 2;

export function lyricText(line: CardLyricLine): string {
  return line.ruby.map((seg) => seg.text).join('');
}

/**
 * 세로 가사 단들이 높이 avail 안에 들도록 글자 크기에 곱할 배율. 줄이기만 하고 키우지는 않는다.
 * 단 길이는 글자 수 × 줄 높이에 단마다 내려 앉히는 오프셋(i × stagger)을 더한 값이다.
 */
export function lyricFitScale(lines: CardLyricLine[], avail: number, lineHeight: number, stagger: number): number {
  const longest = Math.max(0, ...lines.map((line, i) => i * stagger + [...lyricText(line)].length * lineHeight));
  return longest > avail ? avail / longest : 1;
}

/** 글자 폭을 em 단위로 어림한다. 반각 영숫자는 전각의 절반 남짓이다. */
function emWidth(text: string): number {
  return [...text].reduce((sum, ch) => sum + (/[\x20-\x7E]/.test(ch) ? 0.55 : 1), 0);
}

/**
 * 뒷면 가로 가사가 개행 없이 폭 avail 안에 들도록 글자 크기에 곱할 배율. 모든 줄에 같은 배율을 쓴다.
 * 후리가나가 붙은 마디는 본문과 후리가나 중 넓은 쪽이 마디 폭이다.
 */
export function lyricRowFitScale(lines: CardLyricLine[], avail: number, fontSize: number, rubySize: number): number {
  const widest = Math.max(
    0,
    ...lines.map((line) =>
      line.ruby.reduce((sum, seg) => sum + Math.max(emWidth(seg.text) * fontSize, emWidth(seg.reading ?? '') * rubySize), 0),
    ),
  );
  return widest > avail ? avail / widest : 1;
}

/** 문장 여럿이 개행 없이 폭 avail 안에 들도록 글자 크기에 곱할 배율. 모든 문장에 같은 배율을 쓴다. */
export function textFitScale(texts: string[], avail: number, fontSize: number): number {
  const widest = Math.max(0, ...texts.map((text) => emWidth(text) * fontSize));
  return widest > avail ? avail / widest : 1;
}

/** 고른 순서대로 쌓고, 꽉 찬 채로 새 줄을 누르면 가장 먼저 고른 줄을 내린다. */
export function toggleLine(picked: number[], index: number, max = MAX_LYRIC_LINES): number[] {
  if (picked.includes(index)) return picked.filter((i) => i !== index);
  const next = [...picked, index];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** 카드엔 곡 순서대로 싣는다. */
export function pickLines(lines: CardLyricLine[], picked: number[]): CardLyricLine[] {
  return lines.filter((line) => picked.includes(line.index));
}

export function samePick(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort((x, y) => x - y);
  return [...a].sort((x, y) => x - y).every((v, i) => v === sorted[i]);
}
