export type PageResponse<T> = {
  content: T[]
  number: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export type LoginResponse = {
  token: string
  expiresAt: string
}

export type SongSummary = {
  id: number
  title: string
  artist: string
  durationSeconds: number | null
  youtubeUrl: string | null
  artworkUrl: string | null
  createdAt: string | null
}

export type SongDetail = SongSummary & {
  lyric: LyricSummary | null
}

export type LyricSummary = {
  id: number
  songId: number
  lyricType: string
  status: string
  retryCount: number
  lrclibId: number | null
  vocadbId: number | null
  createdAt: string | null
  updatedAt: string | null
}

export type LyricDetail = LyricSummary & {
  rawContent: RawLyricLine[]
  analyzedContent: AnalyzedLyricLine[] | null
}

export type RawLyricLine = {
  index: number
  startTimeMs?: number | null
  text: string
}

export type LyricToken = {
  surface: string
  baseForm: string
  reading: string | null
  baseFormReading: string | null
  partOfSpeech: string
  charStart: number
  charEnd: number
  koreanText?: string | null
  jlpt?: string | null
}

export type AnalyzedLyricLine = {
  index: number
  koreanLyrics: string | null
  koreanPronounciation?: string | null
  tokens: LyricToken[]
}

export type AdminUser = {
  id: number
  provider: string
  username: string
  email: string | null
  name: string | null
  createdAt: string | null
  deletedAt: string | null
}
