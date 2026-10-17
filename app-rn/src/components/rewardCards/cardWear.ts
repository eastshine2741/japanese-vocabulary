import { SongRewardCard } from './types';

/** 복습할 때가 된 단어 비율이 이 아래면 새것이다. */
export const FRESH_DUE = 0.2;

export type WearState = 'fresh' | 'faded' | 'worn' | 'tattered';

/** 카드를 받은 뒤 리뷰한 단어 중 지금 복습할 차례인 비율. 잴 단어가 없으면 0. */
export function dueRatio(card: Pick<SongRewardCard, 'dueCount' | 'reviewedCount'>): number {
  return card.reviewedCount > 0 ? card.dueCount / card.reviewedCount : 0;
}

/** 0 = 새것, 1 = 완전히 낡음. */
export function wearAge(due: number): number {
  const age = (due - FRESH_DUE) / (1 - FRESH_DUE);
  return Math.min(1, Math.max(0, age));
}

/** 남은 코팅(광택) 비율. 1 = 새 카드의 광택, 0 = 코팅이 다 벗겨져 맨 종이. */
export function coatingLeft(age: number): number {
  return Math.pow(1 - age, 1.6);
}

export function wearState(due: number): WearState {
  if (due < FRESH_DUE) return 'fresh';
  if (due < 0.5) return 'faded';
  if (due < 0.9) return 'worn';
  return 'tattered';
}

export type CardSort = 'level' | 'recent' | 'worn';

export const CARD_SORT_LABEL: Record<CardSort, string> = {
  level: '등급순',
  recent: '획득순',
  worn: '낡은순',
};

export const CARD_SORT_ORDER: CardSort[] = ['level', 'recent', 'worn'];

function rank(card: SongRewardCard): number {
  return card.level + (card.mastered ? 1 : 0);
}

export function sortCards(cards: SongRewardCard[], sort: CardSort): SongRewardCard[] {
  const byRecent = (a: SongRewardCard, b: SongRewardCard) => b.earnedAt.localeCompare(a.earnedAt);
  const sorted = [...cards];
  if (sort === 'level') sorted.sort((a, b) => rank(b) - rank(a) || byRecent(a, b));
  if (sort === 'recent') sorted.sort(byRecent);
  if (sort === 'worn') sorted.sort((a, b) => dueRatio(b) - dueRatio(a) || byRecent(a, b));
  return sorted;
}
