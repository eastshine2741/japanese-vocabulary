import type { ArtistCardDto, RewardCardRevealDto, SongCardDto } from '../../types/rewardCard';
import { katakanaToHiragana } from '../../utils/readingConverter';
import { toCardLine } from '../songDetail/songCardSample';
import { ARTIST_GRADE_STEPS } from './artistGrade';
import type { SongCardGrade } from './cardKinds';
import type { ArtistRewardCard, CardLevel, SongRewardCard } from './types';

const SONG_GRADES = ['BASIC', 'BRONZE', 'SILVER', 'GOLD'] as const;
const ARTIST_GRADES = ['BASIC', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const;

// 아트에서 색을 뽑으려면 네이티브 모듈이 필요해, 아직은 카드 id 로 고정 팔레트에서 고른다.
const PALETTE: readonly { accent: string; ink: string }[] = [
  { accent: '#E8C547', ink: '#1C1A12' },
  { accent: '#5EC4C0', ink: '#08191B' },
  { accent: '#FF5FA2', ink: '#1E0E1A' },
  { accent: '#7FA8FF', ink: '#0E1222' },
  { accent: '#FF9F43', ink: '#21140A' },
  { accent: '#4FB3D9', ink: '#0B1820' },
  { accent: '#8E7CFF', ink: '#120F22' },
  { accent: '#B07AE8', ink: '#110A1C' },
  { accent: '#E06A4F', ink: '#170A08' },
  { accent: '#8FD16A', ink: '#0B140A' },
];

export function cardPalette(seed: number): { accent: string; ink: string } {
  return PALETTE[Math.abs(seed) % PALETTE.length];
}

// 더미 아티스트 카드 id(artist-0 …)와 겹치지 않게 접두어를 따로 둔다.
export const songCardId = (songId: number) => `srv-song-${songId}`;
export const artistCardId = (artistId: number) => `srv-artist-${artistId}`;

/** 카드에 찍는 날은 KST 날짜다. */
export function kstDate(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function songGradeOf(grade: string): SongCardGrade {
  if (grade === 'MASTER') return { level: 3, mastered: true };
  const level = SONG_GRADES.indexOf(grade as (typeof SONG_GRADES)[number]);
  return { level: Math.max(0, level) as CardLevel, mastered: false };
}

/** 그 재질이 되는 마스터 곡 수. */
export function artistGradeFrom(grade: string): number {
  const index = ARTIST_GRADES.indexOf(grade as (typeof ARTIST_GRADES)[number]);
  return ARTIST_GRADE_STEPS[Math.max(0, index)].from;
}

export function toSongCard(dto: SongCardDto): SongRewardCard {
  return {
    id: songCardId(dto.songId),
    songId: dto.songId,
    title: dto.title,
    artist: dto.artist,
    artworkUrl: dto.artworkUrl ?? '',
    ...cardPalette(dto.songId),
    ...songGradeOf(dto.grade),
    recall: dto.recall,
    ownerNo: dto.acquiredSeq,
    earnedAt: kstDate(dto.createdAt),
    lyric: dto.lyric.map(toCardLine),
    signature: dto.signature.length > 0 ? dto.signature : null,
    words: dto.words.map((word) => ({ ...word, reading: katakanaToHiragana(word.reading) })),
    nextGoal: dto.nextGoal,
    picked: dto.lyricLineIndexes,
  };
}

export function toArtistCard(dto: ArtistCardDto): ArtistRewardCard {
  return {
    id: artistCardId(dto.artistId),
    artistId: dto.artistId,
    name: dto.name,
    imageUrl: dto.artworkUrl ?? '',
    ...cardPalette(dto.artistId),
    masteredCount: dto.masteredSongs.length,
    fanNo: dto.acquiredSeq,
    since: kstDate(dto.createdAt),
    masteredSongs: dto.masteredSongs.map((song) => ({ title: song.title, artworkUrl: song.artworkUrl ?? '' })),
    signature: dto.signature.length > 0 ? dto.signature : null,
  };
}

export interface ServerRevealTarget {
  kind: 'song' | 'artist';
  cardId: string;
  upgrade: boolean;
  /** 확인하면 이 등급까지 본 것으로 보낸다. */
  grade: string;
  /** 오르기 전 등급. 획득이면 null. */
  fromGrade: string | null;
}

export function toRevealTarget(dto: RewardCardRevealDto): ServerRevealTarget {
  const song = dto.kind === 'SONG';
  return {
    kind: song ? 'song' : 'artist',
    cardId: song ? songCardId(dto.targetId) : artistCardId(dto.targetId),
    upgrade: dto.seenGrade != null,
    grade: dto.grade,
    fromGrade: dto.seenGrade,
  };
}

/** 카드 id 에서 서버 id. 더미 카드면 null. */
export function serverTargetId(cardId: string): number | null {
  const m = cardId.match(/^srv-(?:song|artist)-(\d+)$/);
  return m ? Number(m[1]) : null;
}
