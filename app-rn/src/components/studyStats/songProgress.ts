import { SongDeckSummary } from '../../types/deck';

export interface SongProgressItem {
  deckId: number;
  songId: number | null;
  title: string;
  artist: string;
  artworkUrl: string | null;
  totalWords: number;
  dueCount: number;
  /** 장기기억 단어 수. 곡 상세의 단계 진행 바와 같은 판정이다. */
  longTermCount: number;
  /** 단기기억 단어 수. */
  shortTermCount: number;
}

/** GET /api/decks 는 createdAt 내림차순 하나뿐이다 — 정렬/검색은 클라이언트에서 다시 하지 않는다. */
export function toSongProgressItem(deck: SongDeckSummary): SongProgressItem {
  const totalWords = Math.max(0, deck.wordCount);
  const longTermCount = clamp(deck.longTermCount, 0, totalWords);
  const shortTermCount = clamp(deck.shortTermCount, 0, totalWords - longTermCount);

  return {
    deckId: deck.deckId,
    songId: deck.songId,
    title: deck.title,
    artist: deck.artist,
    artworkUrl: deck.artworkUrl,
    totalWords,
    dueCount: clamp(deck.dueCount, 0, totalWords),
    longTermCount,
    shortTermCount,
  };
}

/** 서버가 아직 새 필드를 안 주는 배포 틈(OTA 선반영)에서도 바가 깨지지 않게 min 으로 떨어뜨린다. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
