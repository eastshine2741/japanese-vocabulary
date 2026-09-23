import type { LyricToken, ReelsLyricLine, ReelsSongDetail } from "@/api/types"
import type { MvCrop, MvFrame, PartOfSpeech, PromoReelData, VocabularyWord } from "@reels/types"

/**
 * 릴스 에디터 상태와 순수 함수. 시간은 전부 MV 기준 절대 ms 다.
 * 줄은 곡 순서(index)로 정렬돼 있고 시작 시각은 그 순서대로 단조 증가한다 — 여기 함수들이 그 불변식을 지킨다.
 */

export type EditorLine = {
  index: number
  startMs: number
  /** 이 줄에서 릴스에 띄울 단어. `ReelsLyricLine.tokens` 의 index 다. */
  tokenIndexes: number[]
}

export type EditorState = {
  /** 클립 시작. 첫 줄과 같거나 더 앞이다. */
  sourceStartMs: number
  /** 가사 구간 끝. 이 뒤에 엔드카드가 붙는다. */
  endMs: number
  lines: EditorLine[]
}

/** 릴스에 찍히는 곡 표기. DB 의 일본어 제목·아티스트 대신 어드민이 고쳐 쓴다. */
export type SongCredit = {
  title: string
  artist: string
}

export const defaultSongCredit = (detail: ReelsSongDetail): SongCredit => ({
  title: detail.song.title,
  artist: detail.song.artist,
})

/** MV 폭 ÷ 릴스 폭. 21:9 MV 를 cover 로 채우는 배율(약 4.2)까지 닿는다. */
export const MV_SCALE_MIN = 0.3
export const MV_SCALE_MAX = 5
/** 1080×1920 캔버스 px. 가장 크게 키운 MV 의 절반 폭만큼 좌우로 민다. */
export const MV_OFFSET_X_MAX = 2700
export const MV_OFFSET_Y_MAX = 1920
const REEL_WIDTH = 1080
const REEL_HEIGHT = 1920

/** 한 변에서 잘라낼 수 있는 최대 비율. MV 에 박힌 레터박스(2.39:1 이면 위아래 각 12%)는 넉넉히 덮는다. */
export const MV_CROP_MAX = 0.4
export const NO_CROP: MvCrop = { top: 0, right: 0, bottom: 0, left: 0 }

export function clampMvFrame(frame: MvFrame): MvFrame {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  const side = (value: number) => Math.round(clamp(value, 0, MV_CROP_MAX) * 10_000) / 10_000
  const crop = frame.crop ?? NO_CROP
  return {
    scale: Math.round(clamp(frame.scale, MV_SCALE_MIN, MV_SCALE_MAX) * 1000) / 1000,
    x: Math.round(clamp(frame.x, -MV_OFFSET_X_MAX, MV_OFFSET_X_MAX)),
    y: Math.round(clamp(frame.y, -MV_OFFSET_Y_MAX, MV_OFFSET_Y_MAX)),
    crop: { top: side(crop.top), right: side(crop.right), bottom: side(crop.bottom), left: side(crop.left) },
  }
}

export function hasCrop(crop: MvCrop | null | undefined): boolean {
  return crop != null && (crop.top > 0 || crop.right > 0 || crop.bottom > 0 || crop.left > 0)
}

/** 잘라낸 뒤 MV 의 가로/세로 비율. */
export function croppedAspect(aspect: number, crop: MvCrop = NO_CROP): number {
  return (aspect * (1 - crop.left - crop.right)) / (1 - crop.top - crop.bottom)
}

/**
 * 가운데 정렬로 캔버스를 꽉 채우는(cover) 배치. MV 비율(가로/세로)이 있어야 배율을 안다.
 * 크롭이 없으면 `mvFrame` 이 null 일 때와 같은 화면이다.
 */
export function coverMvFrame(aspect: number, crop: MvCrop = NO_CROP): MvFrame {
  const scale = Math.max(1, (REEL_HEIGHT * croppedAspect(aspect, crop)) / REEL_WIDTH)
  return clampMvFrame({ scale, x: 0, y: 0, crop })
}

/** 폭을 릴스 폭에 맞추고 가운데 둔다. */
export const FIT_WIDTH_MV_FRAME: MvFrame = { scale: 1, x: 0, y: 0, crop: NO_CROP }

/** 연속한 줄 시작 사이 최소 간격. 드래그로 줄이 겹치는 걸 막는다. */
export const MIN_GAP_MS = 200
/** 타임스탬프 없는 줄을 넣을 때 앞 줄에서 띄우는 기본 간격. */
export const DEFAULT_LINE_GAP_MS = 3000
/** 마지막 줄 뒤에 남기는 기본 여유. 다음 줄 타임스탬프가 없을 때 쓴다. */
export const DEFAULT_TAIL_MS = 4000
/** 다음 줄 타임스탬프가 이보다 멀면(간주) 거기까지 기다리지 않고 자른다. */
export const MAX_TAIL_MS = 8000
/** PromoReel END_CARD_DURATION_IN_FRAMES(210) / 30fps. */
export const END_CARD_MS = 7000

/** 릴스 단어로 고를 수 없는 품사. PromoReel 의 NON_WORD_POS 와 같다. */
const NON_WORD_POS = new Set(["PARTICLE", "AUXILIARY_VERB", "SYMBOL", "SUPPLEMENTARY_SYMBOL", "WHITESPACE"])

export const emptyEditor = (): EditorState => ({ sourceStartMs: 0, endMs: 0, lines: [] })

export function lineByIndex(detail: ReelsSongDetail, index: number): ReelsLyricLine | undefined {
  return detail.lines.find((line) => line.index === index)
}

export function tokenSelectable(token: LyricToken): boolean {
  return !NON_WORD_POS.has(token.partOfSpeech) && (token.koreanText ?? "").trim() !== ""
}

export function tokenToVocabulary(token: LyricToken): VocabularyWord {
  return {
    japanese: token.baseForm || token.surface,
    reading: token.baseFormReading ?? token.reading ?? "",
    korean: token.koreanText ?? "",
    partOfSpeech: token.partOfSpeech,
    jlpt: token.jlpt ?? null,
  }
}

/** 서버 추천 단어를 토큰 index 로 옮긴다. 어드민이 바꾸기 전 기본 선택이다. */
export function defaultTokenIndexes(line: ReelsLyricLine, max: number): number[] {
  const picked: number[] = []
  for (const word of line.recommendedVocabulary) {
    const found = line.tokens.findIndex(
      (token, index) => !picked.includes(index) && tokenSelectable(token) && (token.baseForm || token.surface) === word.japanese,
    )
    if (found >= 0) picked.push(found)
    if (picked.length >= max) break
  }
  return picked
}

/** 릴스에 넣거나 뺀다. 넣을 때 시작 시각은 타임스탬프 → 앞 줄 + 3초 → 클립 시작 순으로 잡는다. */
export function toggleLine(state: EditorState, detail: ReelsSongDetail, index: number): EditorState {
  const existing = state.lines.findIndex((line) => line.index === index)
  if (existing >= 0) {
    return { ...state, lines: state.lines.filter((line) => line.index !== index) }
  }
  const line = lineByIndex(detail, index)
  if (!line || !line.selectable) return state

  const position = state.lines.findIndex((current) => current.index > index)
  const at = position < 0 ? state.lines.length : position
  const prev = state.lines[at - 1]
  const next = state.lines[at]
  let startMs: number
  if (line.startTimeMs != null) startMs = line.startTimeMs
  else if (prev) startMs = prev.startMs + DEFAULT_LINE_GAP_MS
  else if (next) startMs = Math.max(0, next.startMs - DEFAULT_LINE_GAP_MS)
  else startMs = state.sourceStartMs
  if (prev) startMs = Math.max(startMs, prev.startMs + MIN_GAP_MS)
  if (next) startMs = Math.min(startMs, Math.max(prev ? prev.startMs + MIN_GAP_MS : 0, next.startMs - MIN_GAP_MS))

  const inserted: EditorLine = { index, startMs, tokenIndexes: defaultTokenIndexes(line, detail.maxVocabularyPerLine) }
  const lines = normalizeMonotonic([...state.lines.slice(0, at), inserted, ...state.lines.slice(at)])
  const reset = state.lines.length === 0
  const fitted = fitRange({ ...state, lines }, detail, reset)
  // 새 마지막 줄이면 그 줄이 읽힐 만큼은 끝을 미룬다
  const appended = !reset && at === state.lines.length
  return appended ? { ...fitted, endMs: Math.max(fitted.endMs, defaultEndMs(detail, fitted.lines[at])) } : fitted
}

/**
 * 여러 줄을 한 번에 넣거나 뺀다. 줄 목록에서 드래그로 범위를 고를 때 쓴다.
 * 곡 순서로 하나씩 [toggleLine] 을 접어 타이밍 불변식을 그대로 지키고, 이미 그 상태인 줄은 건너뛴다.
 */
export function setLinesIncluded(state: EditorState, detail: ReelsSongDetail, indexes: number[], included: boolean): EditorState {
  const sorted = [...new Set(indexes)].sort((a, b) => a - b)
  return sorted.reduce((current, index) => {
    const has = current.lines.some((line) => line.index === index)
    return has === included ? current : toggleLine(current, detail, index)
  }, state)
}

/** 줄 시작을 옮긴다. 이웃 줄 사이로 clamp 하고, 첫 줄·마지막 줄이면 클립 범위를 넓힌다. */
export function setLineStart(state: EditorState, detail: ReelsSongDetail, index: number, startMs: number): EditorState {
  const at = state.lines.findIndex((line) => line.index === index)
  if (at < 0) return state
  const prev = state.lines[at - 1]
  const next = state.lines[at + 1]
  let clamped = Math.max(0, Math.round(startMs))
  if (prev) clamped = Math.max(clamped, prev.startMs + MIN_GAP_MS)
  if (next) clamped = Math.min(clamped, next.startMs - MIN_GAP_MS)
  const lines = state.lines.map((line, i) => (i === at ? { ...line, startMs: clamped } : line))
  return fitRange({ ...state, lines }, detail, false)
}

export function setSourceStart(state: EditorState, ms: number): EditorState {
  const first = state.lines[0]
  let clamped = Math.max(0, Math.round(ms))
  if (first) clamped = Math.min(clamped, first.startMs)
  clamped = Math.min(clamped, state.endMs - MIN_GAP_MS)
  return { ...state, sourceStartMs: Math.max(0, clamped) }
}

export function setEnd(state: EditorState, ms: number): EditorState {
  const last = state.lines[state.lines.length - 1]
  let clamped = Math.round(ms)
  const floor = (last ? last.startMs : state.sourceStartMs) + MIN_GAP_MS
  clamped = Math.max(clamped, floor)
  return { ...state, endMs: clamped }
}

/** 클립 전체를 앞뒤로 민다. 오버뷰에서 구간을 끌 때 쓴다. */
export function shiftAll(state: EditorState, deltaMs: number): EditorState {
  const delta = Math.max(Math.round(deltaMs), -state.sourceStartMs)
  if (delta === 0) return state
  return {
    sourceStartMs: state.sourceStartMs + delta,
    endMs: state.endMs + delta,
    lines: state.lines.map((line) => ({ ...line, startMs: line.startMs + delta })),
  }
}

export function toggleToken(state: EditorState, index: number, tokenIndex: number, max: number): EditorState {
  return {
    ...state,
    lines: state.lines.map((line) => {
      if (line.index !== index) return line
      if (line.tokenIndexes.includes(tokenIndex)) {
        return { ...line, tokenIndexes: line.tokenIndexes.filter((current) => current !== tokenIndex) }
      }
      if (line.tokenIndexes.length >= max) return line
      return { ...line, tokenIndexes: [...line.tokenIndexes, tokenIndex] }
    }),
  }
}

export function validate(state: EditorState, detail: ReelsSongDetail, credit: SongCredit = defaultSongCredit(detail)): string[] {
  const errors: string[] = []
  if (credit.title.trim() === "") errors.push("곡 제목을 입력해야 합니다")
  if (credit.artist.trim() === "") errors.push("아티스트를 입력해야 합니다")
  if (state.lines.length < detail.minLineCount) {
    errors.push(`줄을 ${detail.minLineCount}개 이상 골라야 합니다 (${state.lines.length}/${detail.minLineCount})`)
  }
  if (state.lines.length === 0) return errors
  const first = state.lines[0]
  const last = state.lines[state.lines.length - 1]
  if (first.startMs < state.sourceStartMs) errors.push("첫 줄이 클립 시작보다 앞에 있습니다")
  for (let i = 1; i < state.lines.length; i += 1) {
    if (state.lines[i].startMs <= state.lines[i - 1].startMs) {
      errors.push(`#${state.lines[i].index + 1} 줄이 앞 줄보다 먼저 시작합니다`)
      break
    }
  }
  if (state.endMs <= last.startMs) errors.push("클립 끝이 마지막 줄보다 앞에 있습니다")
  const span = state.endMs - state.sourceStartMs
  if (span > detail.maxLyricsSpanMs) {
    errors.push(`가사 구간이 ${detail.maxLyricsSpanMs / 1000}초를 넘습니다 (${(span / 1000).toFixed(1)}초)`)
  }
  return errors
}

export const msToFrame = (ms: number, fps: number) => Math.round((ms / 1000) * fps)
export const frameToMs = (frame: number, fps: number) => (frame / fps) * 1000

/** 서버 렌더와 브라우저 Player 가 같이 쓰는 Remotion props. */
export function buildPromoData(
  detail: ReelsSongDetail,
  state: EditorState,
  mvAsset: string,
  credit: SongCredit = defaultSongCredit(detail),
  mvFrame: MvFrame | null = null,
): PromoReelData {
  const fps = detail.fps
  const relative = (ms: number) => msToFrame(ms - state.sourceStartMs, fps)
  const lyricLines = state.lines.flatMap((selected) => {
    const line = lineByIndex(detail, selected.index)
    if (!line) return []
    return [
      {
        startFrame: relative(selected.startMs),
        lineNumber: line.index + 1,
        originalText: line.originalText,
        koreanLyrics: line.koreanLyrics ?? "",
        tokens: line.tokens.map((token) => ({ ...token, partOfSpeech: token.partOfSpeech as PartOfSpeech })),
        vocabulary: selected.tokenIndexes.flatMap((tokenIndex) => {
          const token = line.tokens[tokenIndex]
          return token ? [tokenToVocabulary(token)] : []
        }),
      },
    ]
  })
  const wordCount = new Set(lyricLines.flatMap((line) => line.vocabulary.map((word) => word.japanese))).size
  return {
    song: {
      title: credit.title.trim(),
      artist: credit.artist.trim(),
      artworkAsset: detail.song.artworkUrl ?? "",
      mvAsset,
    },
    headline: detail.headline,
    instagramHandle: detail.instagramHandle,
    catchphrase: detail.catchphrase,
    sourceStartFrame: msToFrame(state.sourceStartMs, fps),
    mvFrame,
    lyricsEndFrame: relative(state.endMs),
    totalLineCount: detail.lines.length,
    wordCount,
    lyricLines,
  }
}

/** `m:ss.t` */
export function formatMs(ms: number): string {
  const total = Math.max(0, ms) / 1000
  const minutes = Math.floor(total / 60)
  const seconds = total - minutes * 60
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`
}

/** `1:23.4`, `83.4`, `83` 을 ms 로. 못 읽으면 null. */
export function parseTimecode(text: string): number | null {
  const trimmed = text.trim()
  const match = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(trimmed)
  if (!match) return null
  const minutes = match[1] ? Number(match[1]) : 0
  const seconds = Number(match[2])
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null
  return Math.round((minutes * 60 + seconds) * 1000)
}

function normalizeMonotonic(lines: EditorLine[]): EditorLine[] {
  const result: EditorLine[] = []
  for (const line of lines) {
    const prev = result[result.length - 1]
    const startMs = prev ? Math.max(line.startMs, prev.startMs + MIN_GAP_MS) : line.startMs
    result.push(startMs === line.startMs ? line : { ...line, startMs })
  }
  return result
}

/**
 * 마지막 줄이 끝나는 기본 시각. 곡에 그 다음 줄 타임스탬프가 있으면 거기까지(간주면 [MAX_TAIL_MS] 로 자름),
 * 없으면 [DEFAULT_TAIL_MS] 만큼 남긴다.
 */
function defaultEndMs(detail: ReelsSongDetail, last: EditorLine): number {
  const nextTimestamp = detail.lines
    .map((line) => line.startTimeMs)
    .filter((ms): ms is number => ms != null && ms > last.startMs + MIN_GAP_MS)
    .sort((a, b) => a - b)[0]
  const end = nextTimestamp ?? last.startMs + DEFAULT_TAIL_MS
  return Math.min(end, last.startMs + MAX_TAIL_MS)
}

/** 클립 범위를 줄에 맞춘다. 처음 줄을 넣을 때는 범위를 새로 잡고, 그 뒤엔 넓히기만 한다. */
function fitRange(state: EditorState, detail: ReelsSongDetail, reset: boolean): EditorState {
  if (state.lines.length === 0) return state
  const first = state.lines[0]
  const last = state.lines[state.lines.length - 1]
  const sourceStartMs = reset ? first.startMs : Math.min(state.sourceStartMs, first.startMs)
  const endMs = reset || state.endMs <= last.startMs ? defaultEndMs(detail, last) : state.endMs
  return { ...state, sourceStartMs, endMs }
}
