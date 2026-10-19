import type { LyricToken, SongReportDetail } from "@/api/types"

export function targetToken(report: SongReportDetail): LyricToken | undefined {
  const { target, context } = report
  if (target?.charStart == null) return undefined
  return context.line?.tokens.find((item) => item.charStart === target.charStart && item.charEnd === target.charEnd)
}

export function segmentationText(tokens: LyricToken[]) {
  return tokens.map((item) => item.surface).join(" / ")
}

/** 제보 유형이 가리키는 필드와 지금 값. 제안과 나란히 놓고 비교하는 기준이다. */
export function reportedField(report: SongReportDetail): { label: string; value: string | null } {
  const { context } = report
  const line = context.line
  const surface = report.target?.surface ?? targetToken(report)?.surface
  switch (report.type) {
    case "LYRIC_TEXT":
      return { label: "Lyric text", value: line?.text ?? null }
    case "TRANSLATION":
      return { label: "Translation", value: line?.koreanLyrics ?? null }
    case "FURIGANA":
      return { label: surface ? `Reading of ${surface}` : "Reading", value: targetToken(report)?.reading ?? null }
    case "WORD_MEANING":
      return { label: surface ? `Meaning of ${surface}` : "Meaning", value: targetToken(report)?.koreanText ?? null }
    case "SEGMENTATION":
      return { label: "Segmentation", value: line ? segmentationText(line.tokens) : null }
    default:
      return { label: "MV link", value: context.song.youtubeUrl }
  }
}

export const changeFieldLabels: Record<string, string> = {
  "song.youtubeUrl": "MV link",
  "lyric.line.text": "Lyric text",
  "lyric.line.koreanLyrics": "Translation",
  "lyric.token.reading": "Reading",
  "lyric.token.koreanText": "Meaning",
  "lyric.line.tokens": "Segmentation",
}

export function formatChangeValue(value: unknown) {
  if (value == null || value === "") return null
  if (typeof value === "string") return value
  if (Array.isArray(value) && value.every((item) => typeof item === "object" && item && "surface" in item)) {
    return segmentationText(value as LyricToken[])
  }
  return JSON.stringify(value)
}
