import { describe, expect, test } from "vitest"
import type { ReelsLyricLine, ReelsSongDetail } from "@/api/types"
import {
  buildPromoData,
  DEFAULT_LINE_GAP_MS,
  DEFAULT_TAIL_MS,
  emptyEditor,
  formatMs,
  MIN_GAP_MS,
  parseTimecode,
  setEnd,
  setLineStart,
  setLinesIncluded,
  setSourceStart,
  shiftAll,
  toggleLine,
  toggleToken,
  validate,
} from "./reelEditor"

const token = (surface: string, partOfSpeech: string, koreanText: string | null, jlpt: string | null = "N5") => ({
  surface,
  baseForm: surface,
  reading: "ヨミ",
  baseFormReading: "ヨミ",
  partOfSpeech,
  charStart: 0,
  charEnd: surface.length,
  koreanText,
  jlpt,
})

function detailWith(lines: Array<Partial<ReelsLyricLine> & { index: number }>): ReelsSongDetail {
  return {
    song: {
      id: 1,
      title: "Lemon",
      artist: "米津玄師",
      durationSeconds: 255,
      youtubeUrl: "https://youtu.be/x",
      artworkUrl: null,
      hasAnalyzedLyrics: true,
      renderEligible: true,
      ineligibleReason: null,
    },
    lyricType: "SYNCED",
    headline: "머리말",
    instagramHandle: "@kotonoha.music",
    catchphrase: "가사에서 바로 배우는 일본어",
    fps: 30,
    minLineCount: 4,
    maxLineCount: null,
    maxLyricsSpanMs: 60_000,
    maxVocabularyPerLine: 2,
    lines: lines.map((line) => ({
      startTimeMs: null,
      originalText: `歌詞${line.index}`,
      koreanLyrics: `가사${line.index}`,
      tokens: [token("夢", "NOUN", "꿈"), token("を", "PARTICLE", null), token("見る", "VERB", "보다", "N4")],
      recommendedVocabulary: [{ japanese: "夢", reading: "ユメ", korean: "꿈" }],
      selectable: true,
      ineligibleReason: null,
      ...line,
    })),
  }
}

const synced = detailWith([0, 1, 2, 3, 4].map((index) => ({ index, startTimeMs: 10_000 + index * 2_000 })))
const plain = detailWith([0, 1, 2, 3, 4].map((index) => ({ index })))

describe("toggleLine", () => {
  test("synced lyrics seed timing from timestamps and fit the clip around the first pick", () => {
    let state = toggleLine(emptyEditor(), synced, 2)
    expect(state.lines).toEqual([{ index: 2, startMs: 14_000, tokenIndexes: [0] }])
    expect(state.sourceStartMs).toBe(14_000)
    // 끝은 곡의 다음 줄(index 3, 16초)이 시작하는 곳
    expect(state.endMs).toBe(16_000)

    // 앞 줄을 나중에 골라도 곡 순서로 들어가고 클립 시작이 앞으로 넓어진다
    state = toggleLine(state, synced, 0)
    expect(state.lines.map((line) => line.index)).toEqual([0, 2])
    expect(state.sourceStartMs).toBe(10_000)
    expect(state.endMs).toBe(16_000)

    // 마지막 줄(index 4) 뒤엔 타임스탬프가 없으니 기본 여유만큼
    state = toggleLine(state, synced, 4)
    expect(state.endMs).toBe(18_000 + DEFAULT_TAIL_MS)
  })

  test("plain lyrics lay lines out at the default gap from the previous line", () => {
    let state = toggleLine(emptyEditor(), plain, 0)
    expect(state.lines[0].startMs).toBe(0)
    expect(state.endMs).toBe(DEFAULT_TAIL_MS)
    state = toggleLine(state, plain, 1)
    state = toggleLine(state, plain, 3)
    expect(state.lines.map((line) => line.startMs)).toEqual([0, DEFAULT_LINE_GAP_MS, DEFAULT_LINE_GAP_MS * 2])
    expect(state.endMs).toBe(DEFAULT_LINE_GAP_MS * 2 + DEFAULT_TAIL_MS)
    // 사이에 끼워 넣으면 이웃 사이로 들어간다
    state = toggleLine(state, plain, 2)
    const [, , third, fourth] = state.lines
    expect(third.index).toBe(2)
    expect(third.startMs).toBeGreaterThanOrEqual(DEFAULT_LINE_GAP_MS + MIN_GAP_MS)
    expect(third.startMs).toBeLessThanOrEqual(fourth.startMs - MIN_GAP_MS)
  })

  test("toggling again removes the line and keeps the clip range", () => {
    const state = toggleLine(toggleLine(emptyEditor(), synced, 0), synced, 1)
    const removed = toggleLine(state, synced, 1)
    expect(removed.lines.map((line) => line.index)).toEqual([0])
    expect(removed.endMs).toBe(state.endMs)
  })

  test("ignores lines that are not selectable", () => {
    const detail = detailWith([{ index: 0, selectable: false, ineligibleReason: "not_analyzed" }])
    expect(toggleLine(emptyEditor(), detail, 0).lines).toEqual([])
  })
})

describe("setLinesIncluded", () => {
  test("adds a dragged range in song order and skips lines already in or not selectable", () => {
    const detail = detailWith([
      { index: 0, startTimeMs: 10_000 },
      { index: 1, startTimeMs: 12_000 },
      { index: 2, startTimeMs: 14_000, selectable: false, ineligibleReason: "no words" },
      { index: 3, startTimeMs: 16_000 },
      { index: 4, startTimeMs: 18_000 },
    ])
    const seeded = toggleLine(emptyEditor(), detail, 3)
    // 범위를 거꾸로 줘도 곡 순서로 들어가고, 이미 든 3번은 그대로다
    const state = setLinesIncluded(seeded, detail, [4, 3, 1, 0], true)
    expect(state.lines.map((line) => line.index)).toEqual([0, 1, 3, 4])
    expect(state.sourceStartMs).toBe(10_000)
    expect(state.endMs).toBe(18_000 + DEFAULT_TAIL_MS)
    // 고를 수 없는 줄은 범위에 있어도 안 들어간다
    expect(setLinesIncluded(state, detail, [2], true)).toEqual(state)
  })

  test("removes a dragged range and leaves the rest untouched", () => {
    let state = emptyEditor()
    for (const index of [0, 1, 2, 3, 4]) state = toggleLine(state, synced, index)
    const removed = setLinesIncluded(state, synced, [1, 2, 3], false)
    expect(removed.lines.map((line) => line.index)).toEqual([0, 4])
    expect(removed.lines[1]).toEqual(state.lines[4])
    expect(removed.endMs).toBe(state.endMs)
    expect(setLinesIncluded(removed, synced, [1, 2], false)).toEqual(removed)
  })
})

describe("timing edits", () => {
  const base = [0, 1, 2, 3].reduce((state, index) => toggleLine(state, synced, index), emptyEditor())

  test("setLineStart clamps between neighbours", () => {
    const moved = setLineStart(base, synced, 1, 20_000)
    expect(moved.lines[1].startMs).toBe(14_000 - MIN_GAP_MS)
    const back = setLineStart(base, synced, 1, 5_000)
    expect(back.lines[1].startMs).toBe(10_000 + MIN_GAP_MS)
  })

  test("moving the first line earlier widens the clip and moving the last later pushes the end", () => {
    const earlier = setLineStart(base, synced, 0, 8_000)
    expect(earlier.sourceStartMs).toBe(8_000)
    const later = setLineStart(setEnd(base, 16_500), synced, 3, 30_000)
    expect(later.endMs).toBe(30_000 + DEFAULT_TAIL_MS)
  })

  test("setSourceStart never passes the first line and setEnd never precedes the last", () => {
    expect(setSourceStart(base, 12_000).sourceStartMs).toBe(10_000)
    expect(setSourceStart(base, -5).sourceStartMs).toBe(0)
    expect(setEnd(base, 1_000).endMs).toBe(16_000 + MIN_GAP_MS)
  })

  test("shiftAll moves the whole clip and stops at zero", () => {
    const shifted = shiftAll(base, -3_000)
    expect(shifted.sourceStartMs).toBe(7_000)
    expect(shifted.lines.map((line) => line.startMs)).toEqual([7_000, 9_000, 11_000, 13_000])
    expect(shiftAll(base, -50_000).sourceStartMs).toBe(0)
  })
})

describe("vocabulary", () => {
  test("toggleToken respects the per-line maximum", () => {
    const state = toggleLine(emptyEditor(), synced, 0)
    const withVerb = toggleToken(state, 0, 2, 2)
    expect(withVerb.lines[0].tokenIndexes).toEqual([0, 2])
    // 상한에 걸리면 무시
    const full = toggleToken(withVerb, 0, 1, 2)
    expect(full.lines[0].tokenIndexes).toEqual([0, 2])
    const removed = toggleToken(full, 0, 0, 2)
    expect(removed.lines[0].tokenIndexes).toEqual([2])
  })
})

describe("validate and buildPromoData", () => {
  test("reports too few lines and an overlong span", () => {
    let state = [0, 1, 2].reduce((current, index) => toggleLine(current, synced, index), emptyEditor())
    expect(validate(state, synced)).toEqual(["줄을 4개 이상 골라야 합니다 (3/4)"])
    state = toggleLine(state, synced, 3)
    expect(validate(state, synced)).toEqual([])
    expect(validate(setEnd(state, 10_000 + 61_000), synced)[0]).toMatch(/60초를 넘습니다/)
  })

  test("builds frames relative to the clip start with the chosen words", () => {
    let state = [0, 1, 2, 3].reduce((current, index) => toggleLine(current, synced, index), emptyEditor())
    state = setSourceStart(state, 9_000)
    state = toggleToken(state, 1, 2, 2)
    const data = buildPromoData(synced, state, "http://mv")
    expect(data.sourceStartFrame).toBe(270)
    expect(data.lyricLines.map((line) => line.startFrame)).toEqual([30, 90, 150, 210])
    // 끝은 다음 줄(index 4, 18초)
    expect(data.lyricsEndFrame).toBe(msToFrame(18_000 - 9_000))
    expect(data.lyricLines[0].lineNumber).toBe(1)
    expect(data.lyricLines[1].vocabulary.map((word) => word.japanese)).toEqual(["夢", "見る"])
    expect(data.lyricLines[1].vocabulary[1]).toMatchObject({ korean: "보다", partOfSpeech: "VERB", jlpt: "N4" })
    expect(data.wordCount).toBe(2)
    expect(data.song.mvAsset).toBe("http://mv")
    expect(data.totalLineCount).toBe(5)
  })

  test("uses the admin-entered song credit and rejects blank ones", () => {
    const state = [0, 1, 2, 3].reduce((current, index) => toggleLine(current, synced, index), emptyEditor())
    const defaults = buildPromoData(synced, state, "http://mv")
    expect(defaults.song).toMatchObject({ title: synced.song.title, artist: synced.song.artist })
    const data = buildPromoData(synced, state, "http://mv", { title: " 레몬 ", artist: "요네즈 켄시" })
    expect(data.song).toMatchObject({ title: "레몬", artist: "요네즈 켄시" })
    expect(validate(state, synced, { title: " ", artist: "" })).toEqual(["곡 제목을 입력해야 합니다", "아티스트를 입력해야 합니다"])
  })
})

describe("timecode", () => {
  test("formats and parses m:ss.t", () => {
    expect(formatMs(83_400)).toBe("1:23.4")
    expect(formatMs(0)).toBe("0:00.0")
    expect(parseTimecode("1:23.4")).toBe(83_400)
    expect(parseTimecode("83.4")).toBe(83_400)
    expect(parseTimecode("83")).toBe(83_000)
    expect(parseTimecode("abc")).toBeNull()
  })
})

const msToFrame = (ms: number) => Math.round((ms / 1000) * 30)
