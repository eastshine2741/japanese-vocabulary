import { describe, expect, it } from 'vitest';
import { toSongProgressItem } from './songProgress';
import type { SongDeckSummary } from '../../types/deck';

const deck = (over: Partial<SongDeckSummary> = {}): SongDeckSummary => ({
  deckId: 1,
  songId: 10,
  title: 'Lemon',
  artist: '米津玄師',
  artworkUrl: null,
  wordCount: 24,
  dueCount: 3,
  masteredCount: 0,
  studyingCount: 0,
  newWordCount: 0,
  longTermCount: 12,
  shortTermCount: 4,
  ...over,
});

describe('toSongProgressItem', () => {
  it('keeps the memory counts the server sent', () => {
    const item = toSongProgressItem(deck());
    expect(item.totalWords).toBe(24);
    expect(item.longTermCount).toBe(12);
    expect(item.shortTermCount).toBe(4);
  });

  it('clamps counts so the three segments never exceed the total', () => {
    const item = toSongProgressItem(deck({ wordCount: 10, longTermCount: 12, shortTermCount: 5 }));
    expect(item.longTermCount).toBe(10);
    expect(item.shortTermCount).toBe(0);
  });

  it('clamps short term to what long term leaves over', () => {
    const item = toSongProgressItem(deck({ wordCount: 10, longTermCount: 7, shortTermCount: 9 }));
    expect(item.longTermCount).toBe(7);
    expect(item.shortTermCount).toBe(3);
  });

  it('floors negative server values instead of drawing backwards segments', () => {
    const item = toSongProgressItem(deck({ wordCount: -1, longTermCount: -3, shortTermCount: -2 }));
    expect(item.totalWords).toBe(0);
    expect(item.longTermCount).toBe(0);
    expect(item.shortTermCount).toBe(0);
  });
});
