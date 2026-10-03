package com.japanese.vocabulary.song.model

/**
 * One analyzed lyric line. The line reading is not stored; clients assemble it from [tokens]
 * (`charStart`/`charEnd` locate each in the raw text), since Hangul conversion needs word boundaries.
 */
data class AnalyzedLine(
    val index: Int,
    val koreanLyrics: String?,
    val tokens: List<Token>
)
