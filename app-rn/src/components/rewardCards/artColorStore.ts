import type { CardColors } from './artPalette';

// artPalette 규칙을 바꾸면 버전을 올린다. 안 올리면 남겨 둔 옛 색이 계속 쓰인다.
const KEY = 'art_colors_v1';

export async function readSavedArtColors(): Promise<Record<string, CardColors>> {
  return JSON.parse(localStorage.getItem(KEY) ?? '{}');
}

export function writeSavedArtColors(colors: Record<string, CardColors>): void {
  localStorage.setItem(KEY, JSON.stringify(colors));
}
