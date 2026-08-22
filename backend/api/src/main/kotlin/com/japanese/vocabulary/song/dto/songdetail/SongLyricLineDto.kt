package com.japanese.vocabulary.song.dto.songdetail

import com.japanese.vocabulary.song.model.Token

data class SongLyricLineDto(
    val index: Int,
    val originalText: String,
    val startTimeMs: Long?,
    val koreanLyrics: String?,
    /** The line's reading in katakana. Clients convert it for display. */
    val pronounciation: String?,
    val tokens: List<Token> = emptyList(),
)
