package com.japanese.vocabulary.translation.model

import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto

data class SegmentationStageResult(
    val segLines: List<SegLineDto>,
    val tokensByIndex: Map<Int, List<PipelineToken>>,
)
