import type { PromoReelData } from "@reels/types"

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
  updatedAt?: string | null
}

export type SongDetail = SongSummary & {
  lyric: LyricSummary | null
  activeReanalysisWork: SongAnalysisWorkSummary | null
  analysisWorks: SongAnalysisWorkSummary[]
}

export type LyricSummary = {
  id: number
  songId: number
  lyricType: string
  lrclibId: number | null
  vocadbId: number | null
  createdAt: string | null
  updatedAt: string | null
}

export type LyricDetail = LyricSummary & {
  rawContent: RawLyricLine[]
  analyzedContent: AnalyzedLyricLine[] | null
}

export type SongAnalysisWorkSummary = {
  id: number
  rawTitle: string
  rawArtist: string
  status: string
  currentStage: string | null
  songId: number | null
  lyricId: number | null
  youtubeUrl: string | null
  triggerSource: string
  createdByUserId: number | null
  createdAt: string | null
  updatedAt: string | null
  playerReadyAt: string | null
  completedAt: string | null
  failedAt: string | null
}

export type SongAnalysisWorkOperation = {
  workId: number
  status: string
  currentStage: string | null
  songId: number | null
  lyricId: number | null
  youtubeUrl: string | null
  canOpenPlayer: boolean
  isAnalysisComplete: boolean
  errorCode: string | null
  errorMessage: string | null
}

export type SongAnalysisWorkDetail = SongAnalysisWorkSummary & {
  durationSeconds: number | null
  artworkUrl: string | null
  activeDedupKey: string | null
  lockedBy: string | null
  lockedUntil: string | null
  errorCode: string | null
  errorMessage: string | null
}

export type RecommendationOperationItem = {
  candidateId: number
  status: string
  songId: number | null
  lyricId: number | null
  workId: number | null
  recommendationId: number | null
  message: string | null
}

export type RecommendationOperationResult = {
  processed: number
  succeeded: number
  skipped: number
  failed: number
  items: RecommendationOperationItem[]
}

export type Recommendation = {
  id: number
  candidateId: number
  weekStartDate: string
  status: string
  songId: number
  lyricId: number
  orderIndex: number
  publishedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type RecommendationCandidate = {
  id: number
  source: string
  sourceSongId: string
  weekStartDate: string
  sourceRank: number
  status: string
  title: string
  artistName: string
  artworkUrl: string | null
  sourceUrl: string | null
  releaseDate: string | null
  createdAt: string | null
  updatedAt: string | null
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
  /** No line-level reading is stored — assemble it from the tokens (`buildLineReading`). */
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
  wordCount: number
  /** 곡 단어장 수. 전체 단어장은 시스템이 만들어 주는 것이라 세지 않는다. */
  songDeckCount: number
  customDeckCount: number
  lastWordSavedAt: string | null
  lastReviewedAt: string | null
}

export type AdminUserDetail = {
  user: AdminUser
  learning: AdminUserLearning
  decks: AdminUserDeck[]
}

export type AdminUserLearning = {
  wordCount: number
  dueCount: number
  newCount: number
  studyingCount: number
  masteredCount: number
  lastWordSavedAt: string | null
  lastReviewedAt: string | null
  reviewDaysLast30: number
  reviewCountLast30: number
}

export type AdminUserDeckKind = "DEFAULT" | "SONG" | "CUSTOM"

export type AdminUserDeck = {
  id: number
  kind: AdminUserDeckKind
  title: string
  description: string
  songId: number | null
  songTitle: string | null
  songArtist: string | null
  wordCount: number
  dueCount: number
  newCount: number
  studyingCount: number
  masteredCount: number
  createdAt: string | null
}

export type AdminWordFlashcardStatus = "NEW" | "STUDYING" | "MASTERED"

export type AdminUserWord = {
  id: number
  japaneseText: string
  reading: string | null
  senses: AdminWordSense[]
  sourceSongs: AdminWordSongRef[]
  flashcard: AdminWordFlashcard | null
  createdAt: string | null
}

export type AdminWordSense = {
  meaning: string
  partOfSpeech: string
  jlpt: string | null
  examples: AdminWordExample[]
}

export type AdminWordExample = {
  text: string
  translation: string | null
  songId: number | null
  lineIndex: number | null
}

export type AdminWordSongRef = {
  id: number
  title: string
  artist: string
}

export type AdminWordFlashcard = {
  status: AdminWordFlashcardStatus
  fsrsState: number
  due: string
  lastReview: string | null
}

export type ReelsSongCandidate = {
  id: number
  title: string
  artist: string
  durationSeconds: number | null
  youtubeUrl: string | null
  artworkUrl: string | null
  hasAnalyzedLyrics: boolean
  renderEligible: boolean
  ineligibleReason: string | null
}

export type ReelsSongDetail = {
  song: ReelsSongCandidate
  /** SYNCED 면 줄에 startTimeMs 가 있어 에디터 초기값으로 쓰고, PLAIN 이면 어드민이 전부 찍는다. */
  lyricType: string
  headline: string
  instagramHandle: string
  catchphrase: string
  fps: number
  minLineCount: number
  maxLineCount: number | null
  maxLyricsSpanMs: number
  maxVocabularyPerLine: number
  lines: ReelsLyricLine[]
}

export type ReelsLyricLine = {
  index: number
  startTimeMs: number | null
  originalText: string
  koreanLyrics: string | null
  tokens: LyricToken[]
  recommendedVocabulary: ReelsVocabulary[]
  selectable: boolean
  ineligibleReason: string | null
}

export type ReelsVocabulary = {
  japanese: string
  reading: string
  korean: string
  partOfSpeech?: string | null
  partOfSpeechLabel?: string | null
  jlpt?: string | null
}

export type ReelsSource = {
  /** admin API base 기준 MV 스트림 상대 경로. 미디어 토큰이 query 에 들어 있다. */
  mvPath: string
}

export type ReelsRenderRequest = {
  songId: number
  data: PromoReelData
  acknowledgeSourceRightsAndPlatformRisk: boolean
}
