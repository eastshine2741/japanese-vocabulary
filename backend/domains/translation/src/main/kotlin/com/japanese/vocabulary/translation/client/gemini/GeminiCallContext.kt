package com.japanese.vocabulary.translation.client.gemini

/**
 * Which lyric a Gemini call belongs to; labels the payload log because concurrent analyses interleave.
 */
data class GeminiCallContext(
    val songId: Long?,
    val lyricId: Long?,
)
