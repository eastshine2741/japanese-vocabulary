package com.japanese.vocabulary.translation.model

data class SenseTranslationStageInput(
    val selectedSenseByKey: Map<PipelineTokenKey, Int>,
    val lexical: LexicalResolution,
)
