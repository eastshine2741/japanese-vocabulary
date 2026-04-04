import { WordMeaning } from './word';

export interface SongDeckSummary {
  songId: number;
  title: string;
  artist: string;
  artworkUrl: string | null;
  wordCount: number;
  dueCount: number;
  masteredCount: number;
}

export interface DeckListResponse {
  songDecks: SongDeckSummary[];
}

export interface DeckDetailResponse {
  songId: number | null;
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  wordCount: number;
  dueCount: number;
  masteredCount: number;
  studyingCount: number;
  newWordCount: number;
}

export interface DeckWordItem {
  id: number;
  japanese: string;
  reading: string;
  meanings: WordMeaning[];
}

export interface DeckWordListResponse {
  words: DeckWordItem[];
  nextCursor: number | null;
}
