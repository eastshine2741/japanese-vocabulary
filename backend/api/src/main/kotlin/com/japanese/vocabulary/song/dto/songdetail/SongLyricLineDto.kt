package com.japanese.vocabulary.song.dto.songdetail

import com.japanese.vocabulary.song.model.Token

data class SongLyricLineDto(
    val index: Int,
    val originalText: String,
    val startTimeMs: Long?,
    val koreanLyrics: String?,
    /** Each token carries the reading sung in this line; the client assembles the line's reading. */
    val tokens: List<Token> = emptyList(),
)
