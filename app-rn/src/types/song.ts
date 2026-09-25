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
  weekStartDate: string;
}

/** 홈 콜드스타트 부트스트랩 응답 — 방금 담은 곡의 남은 due 카드까지 한 번에 담겨 온다. */
export interface SongStudyBootstrapResponse {
  deckId: number;
  cards: FlashcardDTO[];
  totalCount: number;
  nextDueAt: string | null;
  /** 이 호출이 담으면서 바로 리뷰한 lead 단어의 리뷰 **후** 기억 칸. 리뷰 전 칸은 항상 `REMAINING` 이다. */
  reviewedMemory: FlashcardMemory;
}

/**
 * `POST /api/songs/{id}/word-tiers/{key}/study`. 그 단계의 due 단어(한 번도 리뷰 안 했거나 due 가 지난
 * 단어)만 — 카드 수가 `SongWordTierDto.dueCount` 와 같다.
 */
export interface SongWordTierStudyResponse {
  deckId: number;
  cards: FlashcardDTO[];
  totalCount: number;
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
  /** 7일 뒤 회상 확률 90% 이상 (FSRS stability >= 7일) */
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
