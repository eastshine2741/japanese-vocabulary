package com.japanese.vocabulary.song.model

/**
 * One analyzed lyric line.
 *
 * The line's reading is not stored. It is [tokens] — each one carries the reading actually sung in
 * this line, with `charStart`/`charEnd` saying where it sits in the raw text — so a client assembles
 * the reading it wants to show. Storing the assembled string as well cost a field that could drift
 * from the tokens, and it lost the word boundaries that Hangul conversion needs: run the long-vowel
 * rules across a whole line and one word's vowel swallows the next word's leading ウ/イ.
 */
data class AnalyzedLine(
    val index: Int,
    val koreanLyrics: String?,
    val tokens: List<Token>
)
