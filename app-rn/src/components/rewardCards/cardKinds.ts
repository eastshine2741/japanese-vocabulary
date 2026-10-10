import { artistGradeStep, type ArtistGradeStep } from './artistGrade';
import type { ArtistRewardCard, CardLevel, SongRewardCard } from './types';

/** 한 곡에서 얻을 수 있는 곡 카드 종류. 레벨은 한 장의 카드가 오르는 단계라 종류마다 카드가 따로 있지 않다. */
export interface SongCardKind {
  key: string;
  level: CardLevel;
  mastered: boolean;
}

export type SongCardGrade = Pick<SongCardKind, 'level' | 'mastered'>;

export const SONG_CARD_KINDS: readonly SongCardKind[] = [
  { key: 'level-0', level: 0, mastered: false },
  { key: 'level-1', level: 1, mastered: false },
  { key: 'level-2', level: 2, mastered: false },
  { key: 'level-3', level: 3, mastered: false },
  { key: 'master', level: 3, mastered: true },
];

export function ownsSongKind(card: SongRewardCard | null, kind: SongCardKind): boolean {
  if (card == null) return false;
  if (kind.mastered) return card.mastered;
  return card.mastered || card.level >= kind.level;
}

/** 지나온 종류는 내 카드를 그 레벨로 돌려 보여 준다. */
export function songCardAt(card: SongRewardCard, kind: SongCardGrade): SongRewardCard {
  if (card.level === kind.level && card.mastered === kind.mastered) return card;
  return { ...card, level: kind.level, mastered: kind.mastered };
}

export function ownsArtistGrade(card: ArtistRewardCard | null, step: ArtistGradeStep): boolean {
  return card != null && card.masteredCount >= step.from;
}

/** 지나온 재질은 그 재질이 되던 때의 마스터 곡 수로 돌려 보여 준다. */
export function artistCardAt(card: ArtistRewardCard, step: ArtistGradeStep): ArtistRewardCard {
  if (artistGradeStep(card.masteredCount).grade === step.grade) return card;
  return { ...card, masteredCount: step.from, masteredSongs: card.masteredSongs.slice(0, step.from) };
}

// 더미 카드는 songId 가 없어 제목으로 곡과 맞춘다. API 가 생기면 songId 로 바꾼다.
function sameSong(card: SongRewardCard, songId: number, title: string): boolean {
  return (card.songId != null && card.songId === songId) || card.title === title;
}

/** 같은 곡 카드가 여럿이면(레벨 견본 더미) 가장 높은 카드를 쓴다. */
export function findSongCard(cards: readonly SongRewardCard[], songId: number, title: string): SongRewardCard | null {
  let best: SongRewardCard | null = null;
  for (const card of cards) {
    if (!sameSong(card, songId, title)) continue;
    if (best == null || songCardRank(card) > songCardRank(best)) best = card;
  }
  return best;
}

function songCardRank(card: SongRewardCard): number {
  return (card.mastered ? 10 : 0) + card.level;
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
