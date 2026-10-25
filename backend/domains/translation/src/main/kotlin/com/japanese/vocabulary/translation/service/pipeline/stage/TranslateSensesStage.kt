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
        // A short response silently loses meanings (unlisted senseId → null koreanText), so bound it.
        return ChunkedGeminiCall.flatMap(translateInput, TRANSLATE_CHUNK_SENSES) {
            geminiClient.translateSenses(it, input.callContext)
        }.associate { it.senseId to firstMeaning(it.koreanText) }
    }

    companion object {
        const val TRANSLATE_CHUNK_SENSES = 100

        /**
         * 단어 저장은 쉼표마다 뜻 하나로 쪼갠다. 모델이 "A, B" 로 답하면 다른 곡에서 "A" 만 받은 같은 sense 와
         * 합쳐질 때 뜻이 겹쳐 쌓이므로 첫 뜻만 남긴다. 괄호 안 쉼표는 한정어라 자르지 않는다: "(사람, 물건이) 있다".
         */
        fun firstMeaning(koreanText: String): String {
            var depth = 0
            var start = 0
            for ((i, ch) in koreanText.withIndex()) {
                when (ch) {
                    '(', '（', '[', '［' -> depth++
                    ')', '）', ']', '］' -> if (depth > 0) depth--
                    ',', '，', '、' -> if (depth == 0) {
                        val part = koreanText.substring(start, i).trim()
                        if (part.isNotEmpty()) return part
                        start = i + 1
                    }
                }
            }
            return koreanText.substring(start).trim()
        }
    }
}
