import type { LyricToken } from "@/api/types"

/**
 * The katakana reading of a lyric line, assembled from its tokens.
 *
 * The analysis stores no line-level reading — each token carries the reading actually sung in that
 * line, and `charStart`/`charEnd` say where it sits in the raw text. Tokens go in position order and
 * the raw text of any gap between them is copied verbatim: spaces, punctuation and latin runs are
 * not tokens, and reproducing them keeps the line readable.
 *
 * The app assembles the same way (`convertLineReading` in app-rn), converting each token separately
 * so a long vowel cannot cross a word boundary. Here the tokens are shown as-is, so the two are
 * separate ten-line functions rather than a shared package.
 */
export function buildLineReading(rawText: string, tokens: LyricToken[]): string {
  if (tokens.length === 0) return ""

  const parts: string[] = []
  let cursor = 0
  for (const token of [...tokens].sort((a, b) => a.charStart - b.charStart)) {
    if (token.charStart > cursor) {
      parts.push(rawText.slice(cursor, token.charStart))
    }
    parts.push(token.reading ?? token.surface)
    cursor = Math.max(cursor, token.charEnd)
  }
  if (cursor < rawText.length) {
    parts.push(rawText.slice(cursor))
  }
  return parts.join("")
}
