package com.japanese.vocabulary.translation.model

import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto

data class AssembleAnalyzedLinesInput(
    val source: TranslationPipelineSource,
    val translationMap: Map<Int, TranslationResultDto>,
    val wordPreparation: WordPreparationResult,
    val selectedSenseByKey: Map<PipelineTokenKey, Int>,
    val koreanBySenseId: Map<Int, String>,
)
