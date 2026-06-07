package com.japanese.vocabulary.song.model

data class AnalyzedLine(
    val index: Int,
    val koreanLyrics: String?,
    val koreanPronounciation: String?,
    val tokens: List<Token>
)
