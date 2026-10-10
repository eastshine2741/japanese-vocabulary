import { CardLyricLine } from './types';

/** 카드 한 장에 들어가는 가사 줄 수. 앞면 세로쓰기 두 단이 아트 폭의 한계다. */
export const MAX_LYRIC_LINES = 2;

export function lyricText(line: CardLyricLine): string {
  return line.ruby.map((seg) => seg.text).join('');
}

export function lyricKo(lines: CardLyricLine[]): string {
  return lines.map((line) => line.ko).join(' / ');
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
