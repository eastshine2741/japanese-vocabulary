package com.japanese.vocabulary.translation.client.gemini

/**
 * Which lyric a Gemini call belongs to. Only used to label the payload log — the scheduler analyzes
 * a batch of works concurrently, so calls from different songs interleave and a bare timestamp is
 * not enough to tell them apart.
 */
data class GeminiCallContext(
    val songId: Long?,
    val lyricId: Long?,
)
