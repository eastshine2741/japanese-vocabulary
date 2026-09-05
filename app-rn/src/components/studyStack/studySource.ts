import { SongDeckSummary } from '../../types/deck';
import { RecommendedSongItem } from '../../types/song';
import { StudySource } from './types';

export function sourceFromDeck(deck: SongDeckSummary): StudySource {
  return {
    deckId: deck.deckId,
    songId: deck.songId,
    title: deck.title,
    artist: deck.artist,
    artworkUrl: deck.artworkUrl,
    dueCount: deck.dueCount,
    totalCount: deck.wordCount,
  };
}

export function sourceFromRecommendation(item: RecommendedSongItem): StudySource {
  return {
    deckId: null,
    songId: item.songId,
    title: item.title,
    artist: item.artist,
    artworkUrl: item.artworkUrl,
    dueCount: 0,
    totalCount: 0,
  };
}
