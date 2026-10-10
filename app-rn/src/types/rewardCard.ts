import type { SongLyricLineDto } from './song';

export type SongCardGradeDto = 'BASIC' | 'BRONZE' | 'SILVER' | 'GOLD' | 'MASTER';
export type ArtistCardGradeDto = 'BASIC' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

/**
 * 띄울 연출 하나. `seenGrade` 가 null 이면 획득(봉투·서명), 아니면 `seenGrade` 에서 `grade` 로 오르는 연출이다.
 * 곡 카드는 `targetId` 가 songId, 아티스트 카드는 artistId.
 */
export interface RewardCardRevealDto {
  kind: 'SONG' | 'ARTIST';
  targetId: number;
  grade: string;
  seenGrade: string | null;
  acquiredSeq: number;
}

export interface RewardCardWordDto {
  japanese: string;
  /** 가타카나. */
  reading: string;
  meaning: string;
}

export interface SongCardDto {
  songId: number;
  title: string;
  artist: string;
  artworkUrl: string | null;
  artistId: number | null;
  grade: SongCardGradeDto;
  seenGrade: SongCardGradeDto | null;
  acquiredSeq: number;
  /** 주인이 고른 줄. 비어 있으면 서버가 고른 기본 줄이 `lyric` 에 실린다. */
  lyricLineIndexes: number[];
  lyric: SongLyricLineDto[];
  words: RewardCardWordDto[];
  recall: number;
  nextGoal: { current: number; total: number } | null;
  signature: string[];
  masteredAt: string | null;
  createdAt: string;
}

export interface ArtistCardDto {
  artistId: number;
  name: string;
  artworkUrl: string | null;
  grade: ArtistCardGradeDto;
  seenGrade: ArtistCardGradeDto | null;
  acquiredSeq: number;
  signature: string[];
  /** 마스터한 순서대로 전부. */
  masteredSongs: { songId: number; title: string; artworkUrl: string | null }[];
  createdAt: string;
}

export interface RewardCardsResponse {
  songCards: SongCardDto[];
  artistCards: ArtistCardDto[];
}
