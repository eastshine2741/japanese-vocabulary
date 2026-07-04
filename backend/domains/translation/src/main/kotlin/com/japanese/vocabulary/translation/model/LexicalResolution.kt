package com.japanese.vocabulary.translation.model

data class LexicalResolution(
    val byTokenKey: Map<PipelineTokenKey, LexicalResolvedToken>,
    val optionsById: Map<Int, PipelineSenseOption>,
)
