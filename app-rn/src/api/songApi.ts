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
  SongStudyCardsResponse,
  SongWordReviewResponse,
  WordsInSongDto,
  StudyUnit,
  SongWordTiersDto,
  SongWordTierKey,
  SongCoverageDto,
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

  /** 곡 단어 3단계 (완곡까지 3단계) */
  async getWordTiers(id: number): Promise<SongWordTiersDto> {
    const { data } = await client.get<SongWordTiersDto>(`/api/songs/${id}/word-tiers`);
    return data;
  },

  /** 가사 줄 기준 이해도 */
  async getCoverage(id: number): Promise<SongCoverageDto> {
    const { data } = await client.get<SongCoverageDto>(`/api/songs/${id}/coverage`);
    return data;
  },

  /** 홈 콜드스타트 부트스트랩: 이 곡을 통째로 담고 rating 을 준 단어를 곧바로 리뷰한다. */
  /** 곡 상세에서 고른 단어(`leadJapanese`)나 추천곡의 세션 카드. 아무것도 담지 않는다. */
  async getStudyCards(songId: number, leadJapanese?: string | null): Promise<SongStudyCardsResponse> {
    const { data } = await client.get<SongStudyCardsResponse>(`/api/songs/${songId}/study-cards`, {
      params: leadJapanese != null ? { leadJapanese } : undefined,
    });
    return data;
  },

  /** 단계 학습 카드. 그 단계의 due 단어(카드 수 = `dueCount`)를 주되 담지 않는다. */
  async getWordTierCards(songId: number, key: SongWordTierKey): Promise<SongStudyCardsResponse> {
    const { data } = await client.get<SongStudyCardsResponse>(`/api/songs/${songId}/word-tiers/${key}/cards`);
    return data;
  },

  /** 곡 단어장에 없는 카드의 rating. 그 단어 하나만 곡 단어장에 담고 리뷰한다. */
  async reviewSongWord(songId: number, japanese: string, rating: number): Promise<SongWordReviewResponse> {
    const { data } = await client.post<SongWordReviewResponse>(`/api/songs/${songId}/words/review`, { japanese, rating });
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
