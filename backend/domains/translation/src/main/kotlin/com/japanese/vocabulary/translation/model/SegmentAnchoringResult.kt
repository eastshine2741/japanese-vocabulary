package com.japanese.vocabulary.translation.model

/**
 * Line-level outcome of segmentation anchoring. A single bad line no longer invalidates the whole
 * response, and the two ways a line can be wrong are kept apart because they are not equally severe:
 *
 * - [failuresByIndex] holds lines whose **positions are unusable** — a surface the line does not
 *   contain, a surface out of order, a duplicate index, a reading that is not kana. Nothing in the
 *   line can be trusted, so it is absent from [anchoredByIndex] and must be re-segmented.
 * - [incompleteByIndex] holds lines that anchored fine but **left Japanese text out**. Every surface
 *   was found in order, so the tokens that exist carry correct offsets; the line is simply missing
 *   words. Such a line is present in [anchoredByIndex] *and* here, and the caller decides whether one
 *   resample is worth it — the text with no token still renders, just without a word card.
 */
data class SegmentAnchoringResult(
    val anchoredByIndex: Map<Int, List<PipelineToken>>,
    val failuresByIndex: Map<Int, String>,
    val incompleteByIndex: Map<Int, UncoveredRun> = emptyMap(),
)

/**
 * The first run of consecutive Japanese characters on a line that no surface claimed.
 *
 * Kept as data rather than a sentence so the defect report can name [text] on its own; [message] is
 * the sentence the model is shown on retry.
 */
data class UncoveredRun(val lineIndex: Int, val offset: Int, val text: String) {
    val message: String
        get() = "Japanese text '$text' at offset=$offset is not covered by segmentation at line index=$lineIndex"
}
