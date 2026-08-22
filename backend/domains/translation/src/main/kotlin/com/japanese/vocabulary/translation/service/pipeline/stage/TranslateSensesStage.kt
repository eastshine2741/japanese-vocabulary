package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.model.SenseTranslationStageInput
import com.japanese.vocabulary.translation.service.pipeline.ChunkedGeminiCall
import com.japanese.vocabulary.translation.service.pipeline.SenseTranslationPreparer
import org.springframework.stereotype.Component

@Component
class TranslateSensesStage(
    private val geminiClient: GeminiClient,
    private val senseTranslationPreparer: SenseTranslationPreparer,
) : PipelineStage<SenseTranslationStageInput, Map<Int, String>> {

    override suspend fun execute(input: SenseTranslationStageInput): Map<Int, String> {
        val chosenIds = input.selectedSenseByKey.values
            .filter { it >= 0 && input.lexical.optionsById.containsKey(it) }
            .distinct()
            .sorted()
        val translateInput = senseTranslationPreparer.buildInput(chosenIds, input.lexical.optionsById)
        if (translateInput.isEmpty()) return emptyMap()
        // Same output-length exposure as sense-select: one song can choose hundreds of senses. Here a
        // short response loses meanings silently (unlisted senseId → null koreanText), so bound it too.
        return ChunkedGeminiCall.flatMap(translateInput, TRANSLATE_CHUNK_SENSES) {
            geminiClient.translateSenses(it, input.callContext)
        }.associate { it.senseId to it.koreanText }
    }

    companion object {
        /** Senses per sense-translation call. */
        const val TRANSLATE_CHUNK_SENSES = 100
    }
}
