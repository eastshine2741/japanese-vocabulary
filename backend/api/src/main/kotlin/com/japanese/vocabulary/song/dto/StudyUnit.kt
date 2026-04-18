package com.japanese.vocabulary.song.dto

data class StudyUnit(
    val index: Int,
    val originalText: String,
    val startTimeMs: Long? = null,
    val tokens: List<Token> = emptyList(),
    val koreanLyrics: String? = null,
    val koreanPronounciation: String? = null
)
