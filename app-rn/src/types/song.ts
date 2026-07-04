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
  koreanPronounciation: string | null;
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
  koreanPronounciation: string | null;
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
  addRequest: {
    japanese: string;
    reading: string;
    koreanText: string;
    partOfSpeech: string;
    songId: number;
    lyricLine: string;
    koreanLyricLine?: string | null;
  };
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
