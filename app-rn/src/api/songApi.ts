import client from './client';
import {
  SongSearchResponse,
  SongStudyData,
  RecentSongItem,
  RecommendedSongItem,
  AnalyzeSongRequest,
  SongAnalysisWorkResponse,
  SongDto,
  SongLyricsDto,
  WordsInSongDto,
  StudyUnit,
} from '../types/song';

function toLegacyStudyUnits(lyrics: SongLyricsDto): StudyUnit[] {
  return lyrics.lines.map(line => ({
    index: line.index,
    originalText: line.originalText,
    startTimeMs: line.startTimeMs,
    tokens: line.tokens,
    koreanLyrics: line.koreanLyrics,
    koreanPronounciation: line.koreanPronounciation,
  }));
}

function toLegacyStudyData(song: SongDto, lyrics: SongLyricsDto): SongStudyData {
  return {
    song: {
      id: song.id,
      title: song.title,
      artist: song.artist,
      lyricType: song.lyricType,
      artworkUrl: song.artworkUrl,
    },
    studyUnits: toLegacyStudyUnits(lyrics),
    youtubeUrl: song.youtubeUrl,
    lyricsSourceName: lyrics.lyricsSourceName,
    lyricsSourceUrl: lyrics.lyricsSourceUrl,
  };
}

export const songApi = {
  async search(query: string): Promise<SongSearchResponse> {
    const { data } = await client.get<SongSearchResponse>('/api/songs/search', {
      params: { q: query },
    });
    return data;
  },

  async analyze(req: AnalyzeSongRequest): Promise<SongAnalysisWorkResponse> {
    const { data } = await client.post<SongAnalysisWorkResponse>('/api/songs/analyze', req);
    return data;
  },

  async getAnalysisWork(workId: number): Promise<SongAnalysisWorkResponse> {
    const { data } = await client.get<SongAnalysisWorkResponse>(`/api/songs/analysis-work/${workId}`);
    return data;
  },

  async getByTitleArtist(title: string, artistName: string): Promise<SongStudyData | null> {
    const res = await client.get<SongStudyData>('/api/songs', {
      params: { title, artistName },
    });
    if (res.status === 204 || res.data == null || !(res.data as any).song) {
      return null;
    }
    return res.data;
  },

  async getRecent(): Promise<RecentSongItem[]> {
    const { data } = await client.get<RecentSongItem[]>('/api/songs/recent');
    return data;
  },

  async getRecommendations(): Promise<RecommendedSongItem[]> {
    const { data } = await client.get<RecommendedSongItem[]>('/api/songs/recommendations');
    return data;
  },

  async getById(id: number): Promise<SongDto> {
    const { data } = await client.get<SongDto>(`/api/songs/${id}`);
    return data;
  },

  async getLyrics(id: number): Promise<SongLyricsDto> {
    const { data } = await client.get<SongLyricsDto>(`/api/songs/${id}/lyrics`);
    return data;
  },

  async getWords(id: number): Promise<WordsInSongDto> {
    const { data } = await client.get<WordsInSongDto>(`/api/songs/${id}/words`);
    return data;
  },

  async getStudyDataById(id: number): Promise<SongStudyData> {
    const [song, lyrics] = await Promise.all([
      this.getById(id),
      this.getLyrics(id),
    ]);
    return toLegacyStudyData(song, lyrics);
  },

  async getSpotlight(): Promise<SongStudyData | null> {
    const res = await client.get<SongStudyData>('/api/songs/spotlight');
    // 204 No Content (or an empty body) means there is no song to spotlight.
    if (res.status === 204 || res.data == null || !(res.data as any).song) {
      return null;
    }
    return res.data;
  },
};
