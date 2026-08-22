package com.japanese.vocabulary.song.dto.songdetail

import com.japanese.vocabulary.song.model.Token

data class SongLyricLineDto(
    val index: Int,
    val originalText: String,
    val startTimeMs: Long?,
    val koreanLyrics: String?,
    /** The line's reading in katakana. Clients convert it for display. */
    val pronounciation: String?,
    /**
     * Hangul reading kept by lyrics analyzed before [pronounciation] existed. Clients fall back to it
     * as-is — it is already Hangul, so there is nothing to convert. Null for new analysis; drop the
     * field once every song has been re-analyzed.
     */
    val koreanPronounciation: String?,
    val tokens: List<Token> = emptyList(),
)
