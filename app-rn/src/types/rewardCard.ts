import type { SongLyricLineDto } from './song';

export type SongCardGradeDto = 'BASIC' | 'BRONZE' | 'SILVER' | 'GOLD' | 'MASTER';
export type ArtistCardGradeDto = 'BASIC' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

/**
 * 띄울 연출 하나. 곡 카드는 등급마다 따로라 늘 획득(봉투·서명)이고 `cardId` 가 그 등급의 카드다.
 * 아티스트 카드는 한 장이라 `fromGrade` 가 없으면 획득, 있으면 그 등급에서 `grade` 로 오르는 강화다.
 * 곡 카드는 `targetId` 가 songId, 아티스트 카드는 artistId.
 */
export interface RewardCardRevealDto {
  kind: 'SONG' | 'ARTIST';
  cardId: number;
  targetId: number;
  grade: string;
  /** 곡 카드는 등급별 획득 순번, 아티스트 카드는 팬 번호(기본 카드는 null). */
  acquiredSeq: number | null;
  fromGrade?: string | null;
}

export interface RewardCardWordDto {
  japanese: string;
  /** 가타카나. */
  reading: string;
  meaning: string;
}

/** 등급마다 한 장. 같은 곡의 카드들은 id·grade·acquiredSeq·가사·서명·dueCount 만 다르다. */
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
  /** 이 카드를 받은 뒤 리뷰한 tier 단어 수. */
  reviewedCount: number;
  /** reviewedCount 중 지금 복습할 차례인 단어 수. */
  dueCount: number;
  /** 곡의 받은 등급 위 등급마다의 진행, 등급 순서대로. 같은 곡의 카드는 모두 같다. */
  goals: { grade: SongCardGradeDto; current: number; total: number }[];
  signature: string[];
  /** false 면 아직 서명 전. */
  issued: boolean;
  createdAt: string;
}

/** 아티스트마다 한 장. 마스터 곡이 늘면 등급이 오른다. */
export interface ArtistCardDto {
  id: number;
  artistId: number;
  name: string;
  artworkUrl: string | null;
  grade: ArtistCardGradeDto;
  /** 몇 번째 팬인지. BRONZE 에 닿을 때 매기고, 기본 카드는 null. */
  fanNo: number | null;
  signature: string[];
  issued: boolean;
  /** 마스터한 순서대로 전부. */
  masteredSongs: { songId: number; title: string; artworkUrl: string | null }[];
  createdAt: string;
}

/** 곡 카드 등급 조건. 곡마다 같아 목록에 한 번만 온다. */
export interface SongGradeRuleDto {
  /** BRONZE 부터 GOLD 까지 등급 순서대로, 끝내야 하는 곡 상세 단계 이름. */
  tierNames: string[];
  /** MASTER: 곡 단어 중 장기기억 비율(%). */
  masterPercent: number;
}

export interface RewardCardsResponse {
  songCards: SongCardDto[];
  artistCards: ArtistCardDto[];
  songGradeRule: SongGradeRuleDto;
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
  songGradeRule: SongGradeRuleDto;
}
