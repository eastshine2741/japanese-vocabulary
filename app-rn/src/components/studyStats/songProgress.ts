import { SongDeckSummary } from '../../types/deck';

export type SongProgressSort = 'due' | 'recent' | 'progress' | 'title';

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
  lastStudiedAt: string | null;
}

export function toSongProgressItem(deck: SongDeckSummary, index: number): SongProgressItem {
  const totalWords = Math.max(0, deck.wordCount);
  const masteredCount = clamp(deck.masteredCount, 0, totalWords);
  const dueCount = clamp(deck.dueCount, 0, totalWords);
  const remaining = Math.max(0, totalWords - masteredCount);
  const learningCount = Math.min(remaining, dueCount);
  const newCount = Math.max(0, remaining - learningCount);

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
    lastStudiedAt: mockLastStudiedAt(index),
  };
}

export function sortSongProgress(items: SongProgressItem[], sort: SongProgressSort): SongProgressItem[] {
  return [...items].sort((a, b) => {
    if (sort === 'title') {
      return a.title.localeCompare(b.title, 'ko-KR');
    }
    if (sort === 'progress') {
      return b.completionRate - a.completionRate || b.totalWords - a.totalWords;
    }
    if (sort === 'recent') {
      return recentValue(b.lastStudiedAt) - recentValue(a.lastStudiedAt) || b.dueCount - a.dueCount;
    }
    return b.dueCount - a.dueCount
      || recentValue(b.lastStudiedAt) - recentValue(a.lastStudiedAt)
      || b.completionRate - a.completionRate;
  });
}

export function filterSongProgress(items: SongProgressItem[], query: string): SongProgressItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return items;
  return items.filter((item) => {
    return item.title.toLocaleLowerCase().includes(normalized)
      || item.artist.toLocaleLowerCase().includes(normalized);
  });
}

function recentValue(value: string | null): number {
  return value ? Date.parse(value) || 0 : 0;
}

function mockLastStudiedAt(index: number): string {
  const d = new Date();
  d.setDate(d.getDate() - index);
  return d.toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
