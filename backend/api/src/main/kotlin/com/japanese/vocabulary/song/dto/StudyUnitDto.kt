package com.japanese.vocabulary.song.dto

import com.japanese.vocabulary.song.model.Token

data class StudyUnitDto(
    val index: Int,
    val originalText: String,
    val startTimeMs: Long? = null,
    val tokens: List<Token> = emptyList(),
    val koreanLyrics: String? = null,
    /** The line's reading in katakana. Clients convert it for display. */
    val pronounciation: String? = null,
)
