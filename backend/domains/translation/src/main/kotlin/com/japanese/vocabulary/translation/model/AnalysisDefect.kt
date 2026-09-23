package com.japanese.vocabulary.translation.model

/**
 * One word the pipeline is about to ship without a meaning, and why.
 *
 * The pipeline retries what it can; this is what is left when the budget is spent. Nothing
 * downstream can tell a token with no meaning from one that legitimately has none, so the stage that
 * gives up is the only place that can say so — and it says so one defect per line, as
 * `ANALYSIS_DEFECT {json}`, so a log search can group by [cause] and [headword] instead of by song.
 * The runner in `.github/scripts/analysis-feedback` reads exactly this shape.
 */
data class AnalysisDefect(
    val songId: Long?,
    val lyricId: Long?,
    val lineIndex: Int,
    val cause: AnalysisDefectCause,
    /** The text as sung. For [AnalysisDefectCause.UNCOVERED] it is the run no surface claimed. */
    val surface: String,
    /** The dictionary form the lookup was keyed by; null when no token exists to carry one. */
    val headword: String?,
    /** The whole raw lyric line, so a reader can judge the defect without opening the song. */
    val line: String,
    /** Anything cause-specific worth keeping — the rejected senseId, for example. */
    val detail: String? = null,
)

enum class AnalysisDefectCause {
    /** jisho answered with an error on every attempt. An outage to count, not a fact about the word. */
    PROVIDER_ERROR,

    /** jisho answered, and no entry matched the headword or any rescue probe. */
    DICTIONARY_MISS,

    /** Japanese text on the line that no segmented surface covers; it renders with no word card. */
    UNCOVERED,

    /** The sense-select model named a sense the token was not offered, so the token keeps none. */
    SENSE_REJECTED,

    /** The sense-select response had no answer for a token that had senses, so the token keeps none. */
    SENSE_MISSING,
}
