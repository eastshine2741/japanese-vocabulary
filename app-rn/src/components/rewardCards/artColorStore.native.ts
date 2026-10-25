import { File, Paths } from 'expo-file-system';
import type { CardColors } from './artPalette';

// artPalette 규칙을 바꾸면 버전을 올린다. 안 올리면 남겨 둔 옛 색이 계속 쓰인다.
const file = new File(Paths.cache, 'art-colors-v1.json');

export async function readSavedArtColors(): Promise<Record<string, CardColors>> {
  if (!file.exists) return {};
  return JSON.parse(await file.text());
}

export function writeSavedArtColors(colors: Record<string, CardColors>): void {
  file.write(JSON.stringify(colors));
}
