package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.model.SenseTranslationStageInput
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
        return geminiClient.translateSenses(translateInput).associate { it.senseId to it.koreanText }
    }
}
