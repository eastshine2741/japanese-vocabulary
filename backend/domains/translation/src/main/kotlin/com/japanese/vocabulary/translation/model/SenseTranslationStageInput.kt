package com.japanese.vocabulary.translation.model

import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext

data class SenseTranslationStageInput(
    val selectedSenseByKey: Map<PipelineTokenKey, Int>,
    val lexical: LexicalResolution,
    val callContext: GeminiCallContext,
)
