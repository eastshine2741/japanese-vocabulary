import { ARTIST_GRADE_STEPS, artistGradeStep, type ArtistGradeStep } from './artistGrade';
import type { ArtistRewardCard, CardLevel, SongRewardCard } from './types';

/** 한 곡에서 얻을 수 있는 곡 카드 종류. 등급마다 카드가 따로 나온다. */
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

/** 곡 카드 승급 계단 자리. 마스터는 완곡 다음 칸이다. */
export function songRung(card: SongRewardCard): number {
  return card.mastered ? 4 : card.level;
}

export function artistRung(card: ArtistRewardCard): number {
  return ARTIST_GRADE_STEPS.indexOf(artistGradeStep(card.masteredCount));
}

// 더미 카드는 songId 가 없어 제목으로 곡과 맞춘다.
function sameSong(card: SongRewardCard, songId: number | null, title: string | null): boolean {
  return (songId != null && card.songId === songId) || (title != null && card.title === title);
}

/** 한 곡의 내 카드 전부(등급마다 한 장). */
export function songCardsOf(cards: readonly SongRewardCard[], songId: number | null, title: string | null): SongRewardCard[] {
  return cards.filter((card) => sameSong(card, songId, title));
}

/** 그 등급의 내 카드. 아직 받지 않았으면 null. */
export function songCardOfKind(cards: readonly SongRewardCard[], kind: SongCardGrade): SongRewardCard | null {
  return cards.find((card) => card.level === kind.level && card.mastered === kind.mastered) ?? null;
}

/** 한 곡에서 가장 높은 등급의 카드. */
export function findSongCard(cards: readonly SongRewardCard[], songId: number | null, title: string | null): SongRewardCard | null {
  let best: SongRewardCard | null = null;
  for (const card of songCardsOf(cards, songId, title)) {
    if (best == null || songRung(card) > songRung(best)) best = card;
  }
  return best;
}

/** 아직 얻지 않은 등급의 견본. 같은 곡의 카드를 그 등급으로 돌리고 주인 정보를 비운다. */
export function songCardSample(card: SongRewardCard, kind: SongCardGrade): SongRewardCard {
  return { ...card, level: kind.level, mastered: kind.mastered, sample: true, recall: 1 };
}

// 더미 아티스트 카드는 artistId 가 없어 이름으로 맞춘다.
function sameArtist(card: ArtistRewardCard, artistId: number | null, name: string): boolean {
  return (artistId != null && card.artistId === artistId) || card.name === name;
}

/** 한 아티스트의 내 카드 전부(재질마다 한 장). */
export function artistCardsOf(cards: readonly ArtistRewardCard[], artistId: number | null, name: string): ArtistRewardCard[] {
  return cards.filter((card) => sameArtist(card, artistId, name));
}

/** 그 재질의 내 카드. 아직 받지 않았으면 null. */
export function artistCardOfStep(cards: readonly ArtistRewardCard[], step: ArtistGradeStep): ArtistRewardCard | null {
  return cards.find((card) => artistGradeStep(card.masteredCount).grade === step.grade) ?? null;
}

/** 아직 닿지 않은 재질의 견본. 그 재질이 되는 마스터 곡 수로 돌리고 주인 정보를 비운다. */
export function artistCardSample(card: ArtistRewardCard, step: ArtistGradeStep): ArtistRewardCard {
  return { ...card, masteredCount: step.from, sample: true };
}
