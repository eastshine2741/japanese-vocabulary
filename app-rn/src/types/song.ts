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
}

export interface RecentSongItem {
  id: number;
  title: string;
  artist: string;
  artworkUrl: string | null;
}

export interface AnalyzeSongRequest {
  title: string;
  artist: string;
  durationSeconds?: number;
  artworkUrl?: string;
}
