package com.japanese.vocabulary.translation.model

/**
 * Line-level outcome of segmentation anchoring. A single bad line no longer invalidates the whole
 * response: [anchoredByIndex] keeps every line that anchored cleanly, [failuresByIndex] carries the
 * reason for each line that must be re-segmented.
 */
data class SegmentAnchoringResult(
    val anchoredByIndex: Map<Int, List<PipelineToken>>,
    val failuresByIndex: Map<Int, String>,
)
