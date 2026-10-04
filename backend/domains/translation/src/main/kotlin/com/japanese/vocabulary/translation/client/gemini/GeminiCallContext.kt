package com.japanese.vocabulary.translation.client.gemini

/**
 * Which analysis a Gemini call belongs to; labels the payload log because concurrent analyses interleave.
 * The song and lyric rows are only created when analysis completes, so a new song's calls carry only [workId].
 */
data class GeminiCallContext(
    val songId: Long?,
    val lyricId: Long?,
    val workId: Long? = null,
)
