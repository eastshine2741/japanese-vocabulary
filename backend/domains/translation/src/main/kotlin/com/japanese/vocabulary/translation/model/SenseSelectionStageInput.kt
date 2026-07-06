package com.japanese.vocabulary.translation.model

import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto

data class SenseSelectionStageInput(
    val source: TranslationPipelineSource,
    val translationMap: Map<Int, TranslationResultDto>,
    val wordPreparation: WordPreparationResult,
)
