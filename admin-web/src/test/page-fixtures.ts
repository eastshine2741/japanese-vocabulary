import type {
  AdminUser,
  LyricDetail,
  LyricSummary,
  PageResponse,
  Recommendation,
  RecommendationCandidate,
  RecommendationOperationResult,
  SongAnalysisWorkDetail,
  SongAnalysisWorkSummary,
  SongDetail,
  SongSummary,
} from "@/api/types"

export function page<T>(content: T[]): PageResponse<T> {
  return {
    content,
    number: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    first: true,
    last: true,
  }
}

export const songSummary: SongSummary = {
  id: 1,
  title: "夜に駆ける",
  artist: "YOASOBI",
  durationSeconds: 261,
  youtubeUrl: "https://youtu.be/x8VYWazR5mE",
  artworkUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
}

export const lyricSummary: LyricSummary = {
  id: 2,
  songId: 1,
  lyricType: "PLAIN",
  lrclibId: null,
  vocadbId: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

export const songDetail: SongDetail = {
  ...songSummary,
  lyric: lyricSummary,
  activeReanalysisWork: null,
  analysisWorks: [],
}

export const lyricDetail: LyricDetail = {
  ...lyricSummary,
  rawContent: [{ index: 0, text: "沈むように溶けてゆくように" }],
  analyzedContent: [
    {
      index: 0,
      koreanLyrics: "가라앉듯이 녹아가듯이",
      pronounciation: "シズムヨウニトケテユクヨウニ",
      tokens: [
        {
          surface: "沈む",
          baseForm: "沈む",
          reading: "シズム",
          baseFormReading: "シズム",
          partOfSpeech: "VERB",
          charStart: 0,
          charEnd: 2,
          koreanText: "가라앉다",
        },
        {
          surface: "ように",
          baseForm: "ようだ",
          reading: "ヨウニ",
          baseFormReading: "ヨウダ",
          partOfSpeech: "AUXILIARY_VERB",
          charStart: 2,
          charEnd: 5,
          koreanText: "듯이",
        },
        {
          surface: "溶けてゆく",
          baseForm: "溶けてゆく",
          reading: "トケテユク",
          baseFormReading: "トケテユク",
          partOfSpeech: "VERB",
          charStart: 5,
          charEnd: 10,
          koreanText: "녹아가다",
        },
        {
          surface: "ように",
          baseForm: "ようだ",
          reading: "ヨウニ",
          baseFormReading: "ヨウダ",
          partOfSpeech: "AUXILIARY_VERB",
          charStart: 10,
          charEnd: 13,
          koreanText: "듯이",
        },
      ],
    },
  ],
}

export const adminUser: AdminUser = {
  id: 3,
  provider: "google",
  username: "adminread",
  email: "adminread@example.com",
  name: "Admin Read",
  createdAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
}

export const songAnalysisWorkSummary: SongAnalysisWorkSummary = {
  id: 4,
  rawTitle: "夜に駆ける",
  rawArtist: "YOASOBI",
  status: "COMPLETED",
  currentStage: "ANALYZE_LYRICS",
  songId: 1,
  lyricId: 2,
  youtubeUrl: "https://youtu.be/work-mv",
  triggerSource: "USER_APP",
  createdByUserId: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:03:00Z",
  playerReadyAt: "2026-01-01T00:01:00Z",
  completedAt: "2026-01-01T00:03:00Z",
  failedAt: null,
}

export const songAnalysisWorkDetail: SongAnalysisWorkDetail = {
  ...songAnalysisWorkSummary,
  durationSeconds: 261,
  artworkUrl: null,
  activeDedupKey: null,
  lockedBy: null,
  lockedUntil: null,
  errorCode: null,
  errorMessage: null,
}

export const recommendationOperationResult: RecommendationOperationResult = {
  processed: 1,
  succeeded: 1,
  skipped: 0,
  failed: 0,
  items: [
    {
      candidateId: 10,
      status: "SUCCEEDED",
      songId: 1,
      lyricId: 2,
      workId: 4,
      recommendationId: null,
      message: null,
    },
  ],
}

export const recommendationCandidate: RecommendationCandidate = {
  id: 10,
  source: "APPLE_MUSIC_RSS",
  sourceSongId: "apple-10",
  weekStartDate: "2026-06-22",
  sourceRank: 1,
  status: "PENDING",
  title: "Plazma",
  artistName: "Kenshi Yonezu",
  artworkUrl: null,
  sourceUrl: "https://music.apple.com/jp/song/apple-10",
  releaseDate: "2026-06-01",
  createdAt: "2026-06-26T00:00:00Z",
  updatedAt: "2026-06-26T00:00:00Z",
}

export const recommendation: Recommendation = {
  id: 11,
  candidateId: 10,
  weekStartDate: "2026-06-22",
  status: "PENDING",
  songId: 1,
  lyricId: 2,
  orderIndex: 0,
  publishedAt: null,
  createdAt: "2026-06-26T00:10:00Z",
  updatedAt: "2026-06-26T00:10:00Z",
}
