import type { ArtistRewardCard, SongRewardCard } from '../rewardCards/types';
import type { ArtistDetail, ArtistStudyingSong } from '../../types/artist';
import type { SongSearchItem } from '../../types/song';

export type SongCardSlot =
  | { kind: 'owned'; key: string; card: SongRewardCard }
  | { kind: 'studying'; key: string; song: ArtistStudyingSong }
  | { kind: 'popular'; key: string; song: SongSearchItem };

// 더미 카드는 songId 가 없어 제목으로 곡과 맞춘다. API 가 생기면 songId 로 바꾼다.
function sameSong(card: SongRewardCard, songId: number | null, title: string): boolean {
  return (card.songId != null && card.songId === songId) || card.title === title;
}

/** 얻은 카드(마스터·레벨 높은 순) 다음에 이 화면에 보이는 나머지 곡을 빈칸으로 둔다. 분모는 이 화면의 곡 전체다. */
export function buildSongCardSlots(artist: ArtistDetail, cards: readonly SongRewardCard[]): SongCardSlot[] {
  const owned = [...cards].sort(
    (a, b) => Number(b.mastered) - Number(a.mastered) || b.level - a.level || b.earnedAt.localeCompare(a.earnedAt),
  );
  const slots: SongCardSlot[] = owned.map(card => ({ kind: 'owned', key: `card-${card.id}`, card }));
  for (const song of artist.studyingSongs) {
    if (owned.some(card => sameSong(card, song.songId, song.title))) continue;
    slots.push({ kind: 'studying', key: `studying-${song.songId}`, song });
  }
  for (const song of artist.popularSongs) {
    if (owned.some(card => sameSong(card, null, song.title))) continue;
    slots.push({ kind: 'popular', key: `popular-${song.id}`, song });
  }
  return slots;
}

/** 같은 아티스트 카드가 여럿이면(재질 견본 더미) 재질이 가장 높은 카드를 쓴다. */
export function pickArtistCard(cards: readonly ArtistRewardCard[], name: string): ArtistRewardCard | null {
  let best: ArtistRewardCard | null = null;
  for (const card of cards) {
    if (card.name !== name) continue;
    if (best == null || card.masteredCount > best.masteredCount) best = card;
  }
  return best;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}
