import { DeckDetailResponse, SongDeckSummary } from '../../types/deck';
import { RecommendedSongItem } from '../../types/song';
import { flattenExamples } from '../../types/word';
import { StudyCard, StudySource } from './types';

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

/** 전체 단어장은 곡이 없어 songId 가 null 이다 — 헤더가 곡 상세로 가지 않고, 곡은 예문 출처로만 연다. */
export function sourceFromDeckDetail(deck: DeckDetailResponse): StudySource {
  return {
    deckId: deck.deckId,
    songId: deck.songId,
    title: deck.title ?? '전체 단어장',
    artist: deck.artist ?? '저장한 단어',
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

/** 곡이 없는 전체 단어장 카드는 첫 예문의 곡 커버를 무대에 깐다 — 뒷면에서 먼저 보이는 예문의 곡이다. */
export function stageArtworkUrl(card: StudyCard): string | null {
  if (card.source.songId != null) return card.source.artworkUrl;
  return flattenExamples(card.senses).find(ex => ex.artworkUrl)?.artworkUrl ?? card.source.artworkUrl;
}
