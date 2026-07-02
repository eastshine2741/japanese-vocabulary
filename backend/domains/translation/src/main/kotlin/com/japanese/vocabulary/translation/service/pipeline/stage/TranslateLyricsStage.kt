package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
import org.springframework.stereotype.Component

@Component
class TranslateLyricsStage(
    private val geminiClient: GeminiClient,
) : PipelineStage<TranslationPipelineSource, Map<Int, TranslationResultDto>> {

    override suspend fun execute(input: TranslationPipelineSource): Map<Int, TranslationResultDto> {
        val translatedLines = geminiClient.translateLyrics(input.lineInput)
        return validateLineIndices(input.rawByIndex.keys, translatedLines)
    }

    private fun validateLineIndices(
        expectedIndices: Set<Int>,
        translatedLines: List<TranslationResultDto>,
    ): Map<Int, TranslationResultDto> {
        val actualIndices = translatedLines.map { it.index }
        val duplicated = actualIndices.groupingBy { it }.eachCount().filterValues { it > 1 }.keys
        if (duplicated.isNotEmpty()) {
            throw IllegalStateException("Translation returned duplicate line indices: $duplicated")
        }
        val actualSet = actualIndices.toSet()
        if (actualSet != expectedIndices) {
            throw IllegalStateException(
                "Translation line indices mismatch: expected=$expectedIndices actual=$actualSet",
            )
        }
        return translatedLines.associateBy { it.index }
    }
}
