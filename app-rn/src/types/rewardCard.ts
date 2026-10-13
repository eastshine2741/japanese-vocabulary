import type { SongLyricLineDto } from './song';

export type SongCardGradeDto = 'BASIC' | 'BRONZE' | 'SILVER' | 'GOLD' | 'MASTER';
export type ArtistCardGradeDto = 'BASIC' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

/**
 * 띄울 획득 연출(봉투·서명) 하나. 카드는 등급마다 따로 나오므로 `cardId` 가 그 등급의 카드다.
 * 곡 카드는 `targetId` 가 songId, 아티스트 카드는 artistId.
 */
export interface RewardCardRevealDto {
  kind: 'SONG' | 'ARTIST';
  cardId: number;
  targetId: number;
  grade: string;
  acquiredSeq: number;
}

export interface RewardCardWordDto {
  japanese: string;
  /** 가타카나. */
  reading: string;
  meaning: string;
}

/** 등급마다 한 장. 같은 곡의 카드들은 id·grade·acquiredSeq·가사·서명·recall 만 다르다. */
export interface SongCardDto {
  id: number;
  songId: number;
  title: string;
  artist: string;
  artworkUrl: string | null;
  artistId: number | null;
  grade: SongCardGradeDto;
  /** 곡·등급마다 따로 센 획득 순번. */
  acquiredSeq: number;
  /** 주인이 고른 줄. 비어 있으면 서버가 고른 기본 줄이 `lyric` 에 실린다. */
  lyricLineIndexes: number[];
  lyric: SongLyricLineDto[];
  words: RewardCardWordDto[];
  recall: number;
  /** 곡의 다음 등급까지 진행. 같은 곡의 카드는 모두 같다. */
  nextGoal: { current: number; total: number } | null;
  signature: string[];
  /** false 면 아직 서명 전. */
  issued: boolean;
  createdAt: string;
}

/** 재질마다 한 장. */
export interface ArtistCardDto {
  id: number;
  artistId: number;
  name: string;
  artworkUrl: string | null;
  grade: ArtistCardGradeDto;
  /** 아티스트·재질마다 따로 센 획득 순번. */
  acquiredSeq: number;
  signature: string[];
  issued: boolean;
  /** 마스터한 순서대로. 지난 재질의 카드는 다음 재질에 닿기 전까지의 곡만 온다. */
  masteredSongs: { songId: number; title: string; artworkUrl: string | null }[];
  createdAt: string;
}

export interface RewardCardsResponse {
  songCards: SongCardDto[];
  artistCards: ArtistCardDto[];
}

export type RewardCardShareKind = 'song-cards' | 'artist-cards';

export interface RewardCardShareDto {
  token: string;
  url: string;
}

export interface ShareImageUploadUrl {
  uploadUrl: string;
  /** PUT 에 그대로 실어야 한다. 서명에 들어간 헤더다. */
  headers: Record<string, string>;
  expiresAt: string;
}

/** 공유 링크로 보는 남의 카드. kind 에 맞는 쪽만 채워 온다. */
export interface SharedRewardCardDto {
  token: string;
  url: string;
  kind: 'SONG' | 'ARTIST';
  songCard: SongCardDto | null;
  artistCard: ArtistCardDto | null;
  owner: { name: string; profileImageUrl: string | null };
}
