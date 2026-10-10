export type CardLevel = 1 | 2 | 3;

/** 후리가나를 붙일 한 덩어리. reading 이 없으면 가나 그대로. */
export interface RubySegment {
  text: string;
  reading?: string;
}

export interface CardWord {
  japanese: string;
  reading: string;
  meaning: string;
}

export interface CardGoal {
  label: string;
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
  lenticular: boolean;
  /** 완료한 단계 단어들의 평균 FSRS 기억 확률. 낡음은 이 값에서 나온다. */
  recall: number;
  ownerNo: number;
  earnedAt: string;
  /** 앞면 아트 위에 세로로 쓰는 두 줄. */
  frontLines: [string, string];
  backLines: RubySegment[][];
  backKo: string;
  words: CardWord[];
  /** 렌티큘러까지 끝낸 카드는 다음 목표가 없다. */
  nextGoal: CardGoal | null;
}

export interface ArtistRewardCard {
  id: string;
  name: string;
  imageUrl: string;
  level: CardLevel;
  songCardCount: number;
  /** 다음 등급에 필요한 곡 카드 수. 최고 등급이면 null. */
  nextLevelAt: number | null;
}
