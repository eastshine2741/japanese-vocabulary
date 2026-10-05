package com.japanese.vocabulary.translation.client.gemini.dto

/**
 * One translated lyric line. Pronunciation is absent on purpose: it is assembled in
 * [com.japanese.vocabulary.translation.service.pipeline.stage.AssembleAnalyzedLinesStage] from the
 * segmentation readings; asking the model for it doubled the response length.
 */
data class TranslationResultDto(
    val index: Int,
    val koreanLyrics: String,
)
