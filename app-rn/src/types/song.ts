import type { RewardCardRevealDto } from './rewardCard';
import { AddWordRequest, WordSense } from './word';
import { FlashcardDTO, FlashcardMemory } from './flashcard';

export interface SongSearchItem {
  id: string;
  title: string;
  thumbnail: string;
  artistName: string;
  durationSeconds: number;
}

export interface SongSearchResponse {
  items: SongSearchItem[];
}

export interface SongInfo {
  id: number;
  title: string;
  artist: string;
  lyricType: 'SYNCED' | 'PLAIN';
  artworkUrl: string | null;
}

export interface SongDto {
  id: number;
  title: string;
  artist: string;
  /** Apple Music 카탈로그에서 아직 못 이은 곡은 null 이라 아티스트 상세로 갈 수 없다. */
  artistId: number | null;
  durationSeconds: number | null;
  artworkUrl: string | null;
  youtubeUrl: string | null;
  lyricType: 'SYNCED' | 'PLAIN';
}

export interface Token {
  surface: string;
  baseForm: string;
  reading: string | null;
  baseFormReading: string | null;
  partOfSpeech: string;
  charStart: number;
  charEnd: number;
  koreanText: string | null;
}

export interface StudyUnit {
  index: number;
  originalText: string;
  startTimeMs: number | null;
  tokens: Token[];
  koreanLyrics: string | null;
}

export interface SongStudyData {
  song: SongInfo;
  studyUnits: StudyUnit[];
  youtubeUrl: string | null;
  lyricsSourceName: string | null;
  lyricsSourceUrl: string | null;
}

export interface SongLyricLineDto {
  index: number;
  originalText: string;
  startTimeMs: number | null;
  koreanLyrics: string | null;
  /** 줄 발음은 저장되지 않는다. 토큰마다 그 줄에서 불리는 발음이 있어 앱이 조립한다. */
  tokens: Token[];
}

export interface SongLyricsDto {
  lyricId: number;
  lyricsSourceName: string | null;
  lyricsSourceUrl: string | null;
  /** false 면 줄 시각이 앨범 음원 기준이라 MV 와 몇 초씩 어긋날 수 있다. 구버전 서버는 안 내려준다. */
  mvSynced?: boolean;
  lines: SongLyricLineDto[];
}

export interface WordSummaryItemDto {
  japanese: string;
  reading: string | null;
  koreanText: string | null;
  jlpt: string | null;
  importanceScore: number;
}

export interface WordSummaryDto {
  topWords: WordSummaryItemDto[];
  jlptDistribution: Record<string, number>;
  totalCandidateCount: number;
  defaultBulkAddCount: number;
}

export interface WordFilterDefaultsDto {
  pos: string[];
  jlpt: string[];
  includeUnknownJlpt: boolean;
  sortDefault: string;
}

export interface WordInSongItemDto {
  japanese: string;
  surface: string;
  baseForm: string | null;
  reading: string | null;
  koreanText: string | null;
  senses: WordSense[];
  partOfSpeech: string;
  partOfSpeechLabel: string;
  jlpt: string | null;
  importanceScore: number;
  appearanceOrder: number;
  frequency: number;
  lineIndexes: number[];
  isSavedGlobally: boolean;
  isSavedForSong: boolean;
  savedWordId: number | null;
  addRequest: AddWordRequest;
  /** 이 단어 카드를 한 번이라도 리뷰했다. 구버전 서버는 안 내려준다. */
  isStudied?: boolean;
}

export interface WordsInSongDto {
  lyricId: number;
  wordSummary: WordSummaryDto;
  filterDefaults: WordFilterDefaultsDto;
  words: WordInSongItemDto[];
  lineWordIndexes: Record<string, number[]>;
}

export interface SongDetailData {
  song: SongDto;
  lyrics: SongLyricsDto;
  words: WordsInSongDto;
}

export interface RecentSongItem {
  id: number;
  title: string;
  artist: string;
  artworkUrl: string | null;
}

export interface RecommendedSongItem {
  id: number;
  songId: number;
  title: string;
  artist: string;
  artworkUrl: string | null;
}

/**
 * 곡 학습 세션의 카드. 아직 담지 않은 단어도 카드로 오고 `id`·`wordId` 가 null 이다.
 * `inSongDeck` 이 false 면 rating 때 `POST /api/songs/{id}/words/review` 로 그 단어 하나만 담으면서 리뷰한다.
 */
export interface SongStudyCardDto extends Omit<FlashcardDTO, 'id' | 'wordId'> {
  id: number | null;
  wordId: number | null;
  inSongDeck: boolean;
}

/**
 * `GET /api/songs/{id}/study-cards`(고른 단어·추천곡 세션), `GET /api/songs/{id}/word-tiers/{key}/cards`(단계 학습).
 * 단계 학습은 카드 수가 `SongWordTierDto.dueCount` 와 같다. 둘 다 아무것도 담지 않는다.
 */
export interface SongStudyCardsResponse {
  /** 이 곡을 아직 담은 적이 없으면 null. 첫 rating 이 만든다. */
  deckId: number | null;
  cards: SongStudyCardDto[];
  totalCount: number;
}

export interface SongWordReviewResponse {
  deckId: number;
  id: number;
  wordId: number;
  /** 리뷰 **후** 기억 칸. */
  memory: FlashcardMemory;
  rewardCards?: RewardCardRevealDto[];
}

export interface AnalyzeSongRequest {
  title: string;
  artist: string;
  durationSeconds?: number;
  artworkUrl?: string;
}

export type SongAnalysisWorkStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface SongAnalysisWorkResponse {
  workId: number;
  status: SongAnalysisWorkStatus;
  currentStage: string | null;
  /** 0..1. 서버가 단계와 경과 시간으로 계산한 값. */
  progress: number;
  songId: number | null;
  canOpenPlayer: boolean;
  isAnalysisComplete: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}

/** 곡 단어 3단계. 순서대로 후렴 정복 -> 따라 부르기 -> 완곡. 단계끼리 단어가 겹치지 않는다. */
export type SongWordTierKey = 'CHORUS' | 'SINGALONG' | 'FULL';

export interface SongWordTierDto {
  key: SongWordTierKey;
  /** 1부터 시작하는 단계 순서 */
  order: number;
  name: string;
  description: string;
  /** 이 단계에 속한 단어의 `WordInSongItemDto.japanese` */
  wordJapanese: string[];
  totalCount: number;
  /** 구버전 앱용. 새 앱은 longTermCount/shortTermCount 를 쓴다. */
  knownCount: number;
  learningCount: number;
  /** 14일 뒤 회상 확률 90% 이상 (FSRS stability >= 14일) */
  longTermCount: number;
  /** 한 번이라도 리뷰했으나 장기기억이 아닌 단어 */
  shortTermCount: number;
  /** 지금 학습할 단어 수. 한 번도 리뷰 안 한 단어를 포함하며 CTA 라벨과 실제 카드 수가 같다. */
  dueCount: number;
  /** due 단어 앞에서 최대 3개. CTA 롤링 미리보기에 쓴다. */
  duePreviewWords: string[];
}

/** `GET /api/songs/{id}/coverage`. 가사 줄 기준 이해도 — 줄의 tier 단어가 전부 장기기억이면 이해한 줄. */
export interface SongCoverageDto {
  songId: number;
  totalLines: number;
  knownLines: number;
}

export interface SongWordTiersDto {
  songId: number;
  tiers: SongWordTierDto[];
}
