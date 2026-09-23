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
  SongStudyBootstrapResponse,
  WordsInSongDto,
  StudyUnit,
  SongWordTiersDto,
  SongWordTierKey,
  SongWordTierStudyResponse,
} from '../types/song';

function toLegacyStudyUnits(lyrics: SongLyricsDto): StudyUnit[] {
  return lyrics.lines.map(line => ({
    index: line.index,
    originalText: line.originalText,
    startTimeMs: line.startTimeMs,
    tokens: line.tokens,
    koreanLyrics: line.koreanLyrics,
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
  async setAnalysisNotification(songId: number, enabled: boolean): Promise<{
    songId: number; workId: number; enabled: boolean;
  }> {
    const { data } = await client.post<{ songId: number; workId: number; enabled: boolean }>(
      `/api/songs/${songId}/analysis-notifications`, { enabled },
    );
    return data;
  },

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

  /** 곡 단어 4단계 학습 로드맵 */
  async getWordTiers(id: number): Promise<SongWordTiersDto> {
    const { data } = await client.get<SongWordTiersDto>(`/api/songs/${id}/word-tiers`);
    return data;
  },

  /** 홈 콜드스타트 부트스트랩: 이 곡을 통째로 담고 rating 을 준 단어를 곧바로 리뷰한다. */
  async studyBootstrap(songId: number, rating: number, leadJapanese?: string | null): Promise<SongStudyBootstrapResponse> {
    const { data } = await client.post<SongStudyBootstrapResponse>(
      `/api/songs/${songId}/study-bootstrap`,
      { rating, leadJapanese: leadJapanese ?? null },
    );
    return data;
  },

  /** 단계 학습: 그 단계 단어를 곡 단어장에 담고, due 와 무관하게 단계 단어 전부를 카드로 받는다. */
  async studyWordTier(songId: number, key: SongWordTierKey): Promise<SongWordTierStudyResponse> {
    const { data } = await client.post<SongWordTierStudyResponse>(`/api/songs/${songId}/word-tiers/${key}/study`);
    return data;
  },

  async getStudyDataById(id: number): Promise<SongStudyData> {
    const [song, lyrics] = await Promise.all([
      this.getById(id),
      this.getLyrics(id),
    ]);
    return toLegacyStudyData(song, lyrics);
  },
};
