package com.japanese.vocabulary.translation.model

data class LexicalResolvedToken(
    val token: PipelineToken,
    val baseForm: String,
    val options: List<PipelineSenseOption>,
)
