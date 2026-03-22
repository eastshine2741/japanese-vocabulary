package com.japanese.vocabulary.song.dto

data class AnalyzedLine(
    val index: Int,
    val koreanLyrics: String?,
    val koreanPronounciation: String?,
    val tokens: List<Token>
)
