import type { AdminUser, LyricDetail, LyricSummary, PageResponse, SongDetail, SongSummary } from "@/api/types"

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
  status: "COMPLETED",
  retryCount: 0,
  lrclibId: null,
  vocadbId: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

export const songDetail: SongDetail = {
  ...songSummary,
  lyric: lyricSummary,
}

export const lyricDetail: LyricDetail = {
  ...lyricSummary,
  rawContent: [{ index: 0, text: "沈むように溶けてゆくように" }],
  analyzedContent: [
    {
      index: 0,
      koreanLyrics: "가라앉듯이 녹아가듯이",
      koreanPronounciation: "시즈무요-니 토케테유쿠요-니",
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
