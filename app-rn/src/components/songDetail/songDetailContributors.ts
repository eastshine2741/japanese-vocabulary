import type { SongContributor } from '../../types/songReport';

/** 디자인의 파스텔 8색. 자리 순서대로 돌려 쓴다. */
export const CONTRIBUTOR_COLORS = [
  '#A9C7E8',
  '#A7D7BE',
  '#E8CBA3',
  '#C9BEE4',
  '#EFB9B9',
  '#9FD4D4',
  '#D9D2A8',
  '#B9C8EF',
] as const;

export function contributorColor(index: number): string {
  return CONTRIBUTOR_COLORS[index % CONTRIBUTOR_COLORS.length];
}

/** 서버는 프로필 사진을 주지 않는다. 이름 첫 글자로 세운다. */
export function contributorInitial(contributor: SongContributor): string {
  const source = contributor.name?.trim() || contributor.username.trim();
  return [...source][0]?.toUpperCase() ?? '?';
}
