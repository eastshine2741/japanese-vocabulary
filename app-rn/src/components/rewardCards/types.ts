import type { CardSignature } from './signature';

export type CardLevel = 1 | 2 | 3;

/** 후리가나를 붙일 한 덩어리. reading 이 없으면 가나 그대로. */
export interface RubySegment {
  text: string;
  reading?: string;
}

/** 곡 가사 한 줄. index 는 곡 안의 줄 순서. */
export interface CardLyricLine {
  index: number;
  ruby: RubySegment[];
  ko: string;
}

export interface CardWord {
  japanese: string;
  reading: string;
  meaning: string;
}

export interface CardGoal {
  current: number;
  total: number;
}

export interface SongRewardCard {
  id: string;
  songId: number | null;
  title: string;
  artist: string;
  artworkUrl: string;
  /** 아트에서 뽑은 강조색과 그 어두운 바탕색. */
  accent: string;
  ink: string;
  level: CardLevel;
  /** 곡 단어 전체가 장기기억. 마스터 카드는 앞면이 바뀌고 아티스트 카드에 한 곡으로 세어진다. */
  mastered: boolean;
  /** 완료한 단계 단어들의 평균 FSRS 기억 확률. 낡음은 이 값에서 나온다. */
  recall: number;
  ownerNo: number;
  earnedAt: string;
  /** 주인이 고른 가사 1~2줄, 곡 순서대로. 앞면엔 세로로, 뒷면엔 후리가나와 번역을 붙여 쓴다. */
  lyric: CardLyricLine[];
  /** 발급 때 주인이 한 번 그린 서명. 서명 전이면 null. */
  signature: CardSignature | null;
  words: CardWord[];
  /** 마스터 카드는 다음 목표가 없다. */
  nextGoal: CardGoal | null;
}

export interface MasteredSong {
  title: string;
  artworkUrl: string;
}

export interface ArtistRewardCard {
  id: string;
  name: string;
  imageUrl: string;
  accent: string;
  ink: string;
  /** 이 아티스트의 마스터 곡 카드 수. 상한이 없고, 재질은 이 값에서 나온다 (artistGrade). */
  masteredCount: number;
  /** 이 아티스트 카드를 몇 번째로 받았는지. 발급 때 고정. */
  fanNo: number;
  /** 첫 곡 카드를 받은 날. 발급 때 고정. */
  since: string;
  /** 마스터한 곡 전부, 마스터한 순서대로. */
  masteredSongs: MasteredSong[];
  /** 발급 때 주인이 한 번 그린 서명. 서명 전이면 null. */
  signature: CardSignature | null;
}
