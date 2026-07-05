import { SongDetailWordItem, SongDetailWordSaveState } from './types';

export function getSongDetailWordKey(word: SongDetailWordItem): string {
  return `${word.baseForm ?? word.japanese}:${word.appearanceOrder}`;
}

export function getSongDetailWordSaveKey(word: SongDetailWordItem): string {
  return word.addRequest.japanese || word.japanese;
}

export function resolveSongDetailWordSaveState(
  word: SongDetailWordItem,
  saveOverrides: ReadonlyMap<string, SongDetailWordSaveState>,
): SongDetailWordSaveState {
  const override = saveOverrides.get(getSongDetailWordSaveKey(word));
  if (override) {
    return {
      isSavedForSong: override.isSavedForSong,
      savedWordId: override.isSavedForSong ? (override.savedWordId ?? word.savedWordId) : null,
    };
  }
  return {
    isSavedForSong: word.isSavedForSong || word.savedWordId != null,
    savedWordId: word.savedWordId,
  };
}
