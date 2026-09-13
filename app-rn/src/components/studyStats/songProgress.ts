import { SongDeckSummary } from '../../types/deck';

export interface SongProgressItem {
  deckId: number;
  songId: number | null;
  title: string;
  artist: string;
  artworkUrl: string | null;
  totalWords: number;
  dueCount: number;
  masteredCount: number;
  learningCount: number;
  newCount: number;
  completionRate: number;
}

/** GET /api/decks 는 createdAt 내림차순 하나뿐이다 — 정렬/검색은 클라이언트에서 다시 하지 않는다. */
export function toSongProgressItem(deck: SongDeckSummary): SongProgressItem {
  const totalWords = Math.max(0, deck.wordCount);
  const masteredCount = clamp(deck.masteredCount, 0, totalWords);
  const dueCount = clamp(deck.dueCount, 0, totalWords);
  const learningCount = clamp(deck.studyingCount, 0, totalWords);
  const newCount = clamp(deck.newWordCount, 0, totalWords);

  return {
    deckId: deck.deckId,
    songId: deck.songId,
    title: deck.title,
    artist: deck.artist,
    artworkUrl: deck.artworkUrl,
    totalWords,
    dueCount,
    masteredCount,
    learningCount,
    newCount,
    completionRate: totalWords === 0 ? 0 : masteredCount / totalWords,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
