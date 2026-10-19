import { AddWordRequest, WordSense } from '../../types/word';

export type SongDetailJlptLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
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
  senses?: WordSense[];
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
