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
  rawContent: unknown[]
  analyzedContent: unknown[] | null
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
