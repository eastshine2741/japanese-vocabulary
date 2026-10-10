import { SongRewardCard } from './types';

/** FSRS 목표 기억률. due 를 매일 치우면 모든 단어가 이 위라서 카드가 낡지 않는다. */
export const FRESH_RECALL = 0.9;
const TATTERED_RECALL = 0.5;

export type WearState = 'fresh' | 'faded' | 'worn' | 'tattered';

/** 0 = 새것, 1 = 완전히 낡음. */
export function wearAge(recall: number): number {
  const age = (FRESH_RECALL - recall) / (FRESH_RECALL - TATTERED_RECALL);
  return Math.min(1, Math.max(0, age));
}

/** 남은 코팅(광택) 비율. 1 = 새 카드의 광택, 0 = 코팅이 다 벗겨져 맨 종이. */
export function coatingLeft(age: number): number {
  return Math.pow(1 - age, 1.6);
}

export function wearState(recall: number): WearState {
  if (recall >= FRESH_RECALL) return 'fresh';
  if (recall >= 0.8) return 'faded';
  if (recall >= 0.65) return 'worn';
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
  if (sort === 'worn') sorted.sort((a, b) => a.recall - b.recall || byRecent(a, b));
  return sorted;
}
