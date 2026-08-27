import type { LyricToken } from "@/api/types"

/** Parts of speech that are read as part of the word in front of them, never as a word of their own. */
const GLUED_POS = new Set(["PARTICLE", "AUXILIARY_VERB", "SUFFIX"])

const HIRAGANA_ONLY = /^[ぁ-ゖー]+$/

const JAPANESE = /[぀-ヿ㐀-鿿]/

/**
 * The katakana reading of a lyric line, assembled from its tokens in position order — the analysis
 * stores no line-level reading, only each token's reading plus `charStart`/`charEnd`.
 *
 * Japanese writes no spaces, so words are separated here: grammar stays attached to the word in
 * front of it (particles/auxiliaries/suffixes, a reading opening with ッ/ン, an all-hiragana surface
 * after one that is not — 揺ら + せば). Text between tokens is copied through, except Japanese no
 * token claimed: an ad-lib or ruby gloss anchoring left uncovered has no reading, so it reads as a
 * word break.
 *
 * The app assembles the same way (`convertLineReading` in app-rn) and converts each token to Hangul
 * on the way, so the two are separate short functions rather than a shared package.
 */
export function buildLineReading(rawText: string, tokens: LyricToken[]): string {
  if (tokens.length === 0) return ""

  const parts: string[] = []
  let cursor = 0
  let previous: LyricToken | null = null
  for (const token of [...tokens].sort((a, b) => a.charStart - b.charStart)) {
    if (token.charStart > cursor) {
      parts.push(separatorFor(rawText.slice(cursor, token.charStart)))
    } else if (startsNewWord(token, previous)) {
      parts.push(" ")
    }
    parts.push(token.reading ?? token.surface)
    cursor = Math.max(cursor, token.charEnd)
    previous = token
  }
  if (cursor < rawText.length) {
    parts.push(separatorFor(rawText.slice(cursor)))
  }
  return parts.join("").replace(/ {2,}/g, " ").trim()
}

function startsNewWord(token: LyricToken, previous: LyricToken | null): boolean {
  if (previous == null) return false
  if (GLUED_POS.has(token.partOfSpeech)) return false
  const reading = token.reading ?? token.surface
  if (reading.startsWith("ッ") || reading.startsWith("ン")) return false
  if (HIRAGANA_ONLY.test(token.surface) && !HIRAGANA_ONLY.test(previous.surface)) return false
  return true
}

function separatorFor(text: string): string {
  return JAPANESE.test(text) ? " " : text
}
