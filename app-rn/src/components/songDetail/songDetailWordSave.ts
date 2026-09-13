import { SongDetailWordItem } from './types';

export function getSongDetailWordKey(word: SongDetailWordItem): string {
  return `${word.baseForm ?? word.japanese}:${word.appearanceOrder}`;
}
