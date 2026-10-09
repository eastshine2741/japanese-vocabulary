package com.japanese.vocabulary.translation.model

/**
 * Line-level outcome of segmentation anchoring.
 *
 * - [failuresByIndex]: lines with **unusable positions** (surface missing/out of order, duplicate
 *   index, non-kana reading). Absent from [anchoredByIndex]; must be re-segmented.
 * - [incompleteByIndex]: lines that anchored fine but **left Japanese text out**. Present in
 *   [anchoredByIndex] *and* here; the caller decides whether one resample is worth it.
 */
data class SegmentAnchoringResult(
    val anchoredByIndex: Map<Int, List<PipelineToken>>,
    val failuresByIndex: Map<Int, String>,
    val incompleteByIndex: Map<Int, UncoveredRun> = emptyMap(),
)

/**
 * The first run of consecutive Japanese characters on a line that no surface claimed.
 * [message] is the sentence the model is shown on retry.
 */
data class UncoveredRun(val lineIndex: Int, val offset: Int, val text: String) {
    val message: String
        get() = "Japanese text '$text' at offset=$offset is not covered by segmentation at line index=$lineIndex"
}
