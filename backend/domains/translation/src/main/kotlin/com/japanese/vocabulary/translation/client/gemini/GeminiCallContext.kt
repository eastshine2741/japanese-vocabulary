package com.japanese.vocabulary.translation.client.gemini

import java.util.concurrent.atomic.DoubleAdder

/**
 * Which analysis a Gemini call belongs to; labels the payload log because concurrent analyses interleave.
 * The song and lyric rows are only created when analysis completes, so a new song's calls carry only [workId].
 */
data class GeminiCallContext(
    val songId: Long?,
    val lyricId: Long?,
    val workId: Long? = null,
    /** Pipeline stage name for metric tags; null outside the worker's stage executor. */
    val stage: String? = null,
    /** One stage run's LLM spend. ANALYZE_LYRICS adds to it from parallel calls, hence the adder. */
    val llmCostUsd: DoubleAdder? = null,
) {
    val stageTag: String get() = stage ?: "none"
}
