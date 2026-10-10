import { ARTIST_GRADE_STEPS, artistGradeStep } from './artistGrade';
import { ArtistRewardCard, CardLevel, SongRewardCard } from './types';

/** 한 단계 아래 재질의 같은 카드. 문지르기 전에 보여 준다. 기본 카드면 오른 적이 없어 null. */
export function previousSongCard(card: SongRewardCard): SongRewardCard | null {
  if (card.mastered) return { ...card, mastered: false };
  if (card.level === 0) return null;
  return { ...card, level: (card.level - 1) as CardLevel };
}

/** 곡 카드 승급 계단 자리. 마스터는 완곡 다음 칸이다. */
export function songRung(card: SongRewardCard): number {
  return card.mastered ? 4 : card.level;
}

/** 지금 재질이 막 시작된 마스터 곡 수에서 한 곡 모자란 카드. 기본 재질이면 null. */
export function previousArtistCard(card: ArtistRewardCard): ArtistRewardCard | null {
  const step = artistGradeStep(card.masteredCount);
  if (step.from === 0) return null;
  const count = step.from - 1;
  return { ...card, masteredCount: count, masteredSongs: card.masteredSongs.slice(0, count) };
}

export function artistRung(card: ArtistRewardCard): number {
  return ARTIST_GRADE_STEPS.indexOf(artistGradeStep(card.masteredCount));
}
