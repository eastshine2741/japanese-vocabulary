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
    /**
     * Hangul reading kept by lyrics analyzed before [pronounciation] existed. Clients fall back to it
     * as-is. Null for new analysis; drop the field once every song has been re-analyzed.
     */
    val koreanPronounciation: String? = null,
)
