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
  utaitedbId: number | null
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

export type SongAnalysisStage = {
  stage: string
  status: string
  attempt: number
  errorCode: string | null
  errorClass: string | null
  errorMessage: string | null
  outputLength: number | null
  startedAt: string | null
  finishedAt: string | null
}

export type SongAnalysisWorkDetail = SongAnalysisWorkSummary & {
  durationSeconds: number | null
  artworkUrl: string | null
  errorCode: string | null
  errorMessage: string | null
  startedAt: string | null
  stages: SongAnalysisStage[]
  resumable: boolean
  rerunFrom: string | null
  sourceWorkId: number | null
  /** stage name -> why it cannot be rerun from this work; null when it can. */
  rerunBlockers: Record<string, string | null>
}

export type Recommendation = {
  id: number
  songId: number
  title: string
  artist: string
  artworkUrl: string | null
  orderIndex: number
  createdAt: string
}

export type ArtistSummary = {
  id: number
  name: string
  artworkUrl: string | null
}

export type ArtistChannel = {
  channelId: string
  channelTitle: string | null
  createdAt: string | null
}

export type ArtistDetail = {
  artist: ArtistSummary
  appleMusicUrl: string | null
  youtubeChannels: ArtistChannel[]
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

export type ManualPushResult = {
  userId: number
  targetTokens: number
  sent: number
  failed: number
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
  lines: ReelsLyricLine[]
}

export type ReelsLyricLine = {
  index: number
  startTimeMs: number | null
  originalText: string
  koreanLyrics: string | null
  tokens: LyricToken[]
  selectable: boolean
  ineligibleReason: string | null
}

export type ReelsSource = {
  /** admin API base 기준 MV 스트림 상대 경로. 미디어 토큰이 query 에 들어 있다. */
  mvPath: string
}

export type ReelsRenderJobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED"

/** 서버가 뒤에서 돌리는 렌더. 브라우저를 닫아도 계속되고 끝난 결과는 몇 시간 남는다. */
export type ReelsRenderJob = {
  id: string
  songId: number
  title: string
  artist: string
  status: ReelsRenderJobStatus
  error: string | null
  createdAt: string
  finishedAt: string | null
}

export type ReelsRenderRequest = {
  songId: number
  data: PromoReelData
  acknowledgeSourceRightsAndPlatformRisk: boolean
}

export type SongReportStatus = "PENDING" | "APPROVED" | "REJECTED"

export type SongReportSummary = {
  id: number
  songId: number
  songTitle: string
  songArtist: string
  userId: number
  username: string
  type: string
  typeLabel: string
  status: SongReportStatus
  createdAt: string
  reviewedAt: string | null
}

export type SongReportTarget = {
  lineIndex?: number | null
  charStart?: number | null
  charEnd?: number | null
  surface?: string | null
}

export type SongReportReviewChange = {
  field: string
  locator: Record<string, unknown>
  before: unknown
  after: unknown
}

export type SongReportContext = {
  song: { id: number; title: string; artist: string; youtubeUrl: string | null }
  reportLyricId: number | null
  activeLyricId: number | null
  line: { index: number; text: string; koreanLyrics: string | null; tokens: LyricToken[] } | null
}

export type SongReportDetail = SongReportSummary & {
  target: SongReportTarget | null
  suggestion: string | null
  reviewChanges: SongReportReviewChange[] | null
  reviewNote: string | null
  context: SongReportContext
}

export type SongReportChangeOp =
  | { op: "SET_YOUTUBE_URL"; value: string }
  | { op: "SET_LINE_TEXT"; lineIndex: number; value: string }
  | { op: "SET_LINE_TRANSLATION"; lineIndex: number; value: string }
  | { op: "SET_TOKEN_READING"; lineIndex: number; charStart: number; charEnd: number; value: string }
  | { op: "SET_TOKEN_MEANING"; lineIndex: number; charStart: number; charEnd: number; value: string }
  | { op: "REPLACE_LINE_TOKENS"; lineIndex: number; tokens: LyricToken[] }

export type FeatureFlag = {
  key: string
  startAt: string | null
  endAt: string | null
  description: string
  on: boolean
  updatedAt: string | null
}

export type LyricMvSyncSummary = {
  id: number
  songId: number | null
  title: string | null
  artist: string | null
  lyricId: number
  lyricType: string | null
  youtubeVideoId: string
  status: string
  method: string | null
  attempt: number
  verdict: string | null
  lineCount: number | null
  anchoredCount: number | null
  errorMessage: string | null
  completedAt: string | null
  inUse: boolean
}

export type LyricMvSyncLine = {
  index: number
  text: string
  originalStartTimeMs: number | null
  syncedStartTimeMs: number | null
}

export type LyricMvSyncDetail = {
  summary: LyricMvSyncSummary
  confidence: Record<string, unknown> | null
  lines: LyricMvSyncLine[]
}
