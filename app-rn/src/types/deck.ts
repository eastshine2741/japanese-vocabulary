import { WordSense } from './word';

/** songId 가 null 이면 곡에 매핑되지 않은 일반 단어장이다. */
export interface SongDeckSummary {
  deckId: number;
  songId: number | null;
  title: string;
  artist: string;
  artworkUrl: string | null;
  wordCount: number;
  dueCount: number;
  masteredCount: number;
}

export interface DeckListResponse {
  songDecks: SongDeckSummary[];
  nextCursor: number | null;
}

export interface DeckDetailResponse {
  deckId: number | null;
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
  senses: WordSense[];
}

export interface DeckWordListResponse {
  words: DeckWordItem[];
  nextCursor: number | null;
}

export interface CreateDeckRequest {
  title: string;
  description?: string | null;
}

export interface DeckResponse {
  deckId: number;
  songId: number | null;
  isDefault: boolean;
  title: string;
  description: string;
}
