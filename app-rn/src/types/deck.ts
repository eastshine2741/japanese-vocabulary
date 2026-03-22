import { WordMeaning } from './word';

export interface AllDeckSummary {
  wordCount: number;
  avgRetrievability: number | null;
}

export interface SongDeckSummary {
  songId: number;
  title: string;
  artist: string;
  artworkUrl: string | null;
  wordCount: number;
  avgRetrievability: number | null;
}

export interface DeckListResponse {
  allDeck: AllDeckSummary;
  songDecks: SongDeckSummary[];
}

export interface StateCounts {
  new: number;
  learning: number;
  review: number;
  relearning: number;
}

export interface DeckDetailResponse {
  songId: number | null;
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  wordCount: number;
  dueCount: number;
  stateCounts: StateCounts;
  avgRetrievability: number | null;
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
