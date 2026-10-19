import { ARTIST_GRADE_STEPS, artistGradeStep, type ArtistGradeStep } from './artistGrade';
import type { ArtistRewardCard, CardLevel, SongRewardCard } from './types';

/** 한 곡에서 얻을 수 있는 곡 카드 종류. 등급마다 카드가 따로 나온다. */
export interface SongCardKind {
  key: string;
  level: CardLevel;
  mastered: boolean;
}

export type SongCardGrade = Pick<SongCardKind, 'level' | 'mastered'>;

/** 곡 카드 등급 이름. 등급이 아티스트 카드와 같아 이름도 맞추되, 마스터는 아티스트의 플래티넘·다이아와 섞이지 않게 따로 둔다. */
export const SONG_TIER_NAME: Record<CardLevel, string> = { 0: '기본', 1: 'BRONZE', 2: 'SILVER', 3: 'GOLD' };
export const SONG_MASTER_NAME = 'MASTER';

export function songTierName(level: CardLevel, mastered: boolean): string {
  return mastered ? SONG_MASTER_NAME : SONG_TIER_NAME[level];
}

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

/** 지금 등급이 막 시작된 마스터 곡 수에서 한 곡 모자란 카드. 기본 카드면 null. */
export function previousArtistCard(card: ArtistRewardCard): ArtistRewardCard | null {
  const step = artistGradeStep(card.masteredCount);
  if (step.from === 0) return null;
  const count = step.from - 1;
  return { ...card, masteredCount: count, masteredSongs: card.masteredSongs.slice(0, count), fanNo: count >= 1 ? card.fanNo : null };
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
  return { ...card, level: kind.level, mastered: kind.mastered, sample: true, reviewedCount: 0, dueCount: 0 };
}

// 더미 아티스트 카드는 artistId 가 없어 이름으로 맞춘다.
function sameArtist(card: ArtistRewardCard, artistId: number | null, name: string): boolean {
  return (artistId != null && card.artistId === artistId) || card.name === name;
}

/** 한 아티스트의 내 카드. 아티스트마다 한 장이지만 더미는 이름으로 맞춰 여럿일 수 있다. */
export function artistCardsOf(cards: readonly ArtistRewardCard[], artistId: number | null, name: string): ArtistRewardCard[] {
  return cards.filter((card) => sameArtist(card, artistId, name));
}

/** 지금 그 등급인 내 카드. 지나온 등급이거나 아직이면 null. */
export function artistCardOfStep(cards: readonly ArtistRewardCard[], step: ArtistGradeStep): ArtistRewardCard | null {
  return cards.find((card) => artistGradeStep(card.masteredCount).grade === step.grade) ?? null;
}

/** 그 등급에 닿은 내 카드. 지나온 등급도 포함한다. */
export function artistCardReaching(cards: readonly ArtistRewardCard[], step: ArtistGradeStep): ArtistRewardCard | null {
  return cards.find((card) => card.masteredCount >= step.from) ?? null;
}

/** 아직 닿지 않았거나 지나온 등급의 견본. 그 등급이 되는 마스터 곡 수로 돌리고 주인 정보를 비운다. */
export function artistCardSample(card: ArtistRewardCard, step: ArtistGradeStep): ArtistRewardCard {
  // 기본 카드엔 팬 번호가 없지만 BRONZE 부터는 번호 자리가 있다. 견본이라 값은 '—' 로 그린다.
  const fanNo = step.from >= 1 ? (card.fanNo ?? 0) : null;
  return { ...card, masteredCount: step.from, fanNo, sample: true };
}

/** 보관함 한 칸. 같은 곡(아티스트)의 카드들을 가장 높은 등급 카드 한 장으로 묶는다. */
export interface CardStack<T> {
  top: T;
  count: number;
}

function stackBy<T>(cards: readonly T[], keyOf: (card: T) => string, rungOf: (card: T) => number): CardStack<T>[] {
  const stacks = new Map<string, CardStack<T>>();
  for (const card of cards) {
    const key = keyOf(card);
    const stack = stacks.get(key);
    if (stack == null) stacks.set(key, { top: card, count: 1 });
    else stacks.set(key, { top: rungOf(card) > rungOf(stack.top) ? card : stack.top, count: stack.count + 1 });
  }
  return [...stacks.values()];
}

export function songCardStacks(cards: readonly SongRewardCard[]): CardStack<SongRewardCard>[] {
  return stackBy(cards, (card) => (card.songId != null ? `id:${card.songId}` : `title:${card.title}`), songRung);
}

export function artistCardStacks(cards: readonly ArtistRewardCard[]): CardStack<ArtistRewardCard>[] {
  return stackBy(cards, (card) => (card.artistId != null ? `id:${card.artistId}` : `name:${card.name}`), artistRung);
}
