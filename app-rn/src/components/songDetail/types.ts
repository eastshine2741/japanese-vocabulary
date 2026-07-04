import { AddWordRequest } from '../../types/word';

export type SongDetailJlptLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
export type SongDetailJlptBucket = SongDetailJlptLevel | 'UNKNOWN';
export type SongDetailWordsSort = 'importance' | 'appearance';

export interface SongDetailWordSummary {
  totalCandidateCount?: number;
  defaultBulkAddCount?: number;
  savedCount?: number;
  byJlpt?: Record<string, number>;
  byPartOfSpeech?: Record<string, number>;
}

export interface SongDetailFilterDefaults {
  pos?: string[];
  jlpt?: string[];
  includeUnknownJlpt?: boolean;
  sortDefault?: string;
}

export interface SongDetailWordItem {
  japanese: string;
  surface: string;
  baseForm: string | null;
  reading: string | null;
  koreanText: string | null;
  partOfSpeech: string;
  partOfSpeechLabel: string | null;
  jlpt: SongDetailJlptLevel | string | null;
  importanceScore: number;
  appearanceOrder: number;
  frequency: number;
  lineIndexes: number[];
  isSavedGlobally: boolean;
  isSavedForSong: boolean;
  savedWordId: number | null;
  addRequest: AddWordRequest;
}

export interface WordsInSongDto {
  words: SongDetailWordItem[];
  wordSummary?: SongDetailWordSummary;
  filterDefaults?: SongDetailFilterDefaults;
  lineWordIndexes?: Record<string, number[]>;
}

export interface SongDetailJlptSlice {
  key: SongDetailJlptBucket;
  label: string;
  count: number;
  percent: number;
  color: string;
}

export interface SongDetailWordSaveState {
  isSavedForSong: boolean;
  savedWordId: number | null;
}
