package com.japanese.vocabulary.translation.model

import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto

data class WordPreparationResult(
    val segLines: List<SegLineDto>,
    val tokensByIndex: Map<Int, List<PipelineToken>>,
    val ruleResolvedByKey: Map<PipelineTokenKey, RuleResolvedToken>,
    val lexical: LexicalResolution,
)
