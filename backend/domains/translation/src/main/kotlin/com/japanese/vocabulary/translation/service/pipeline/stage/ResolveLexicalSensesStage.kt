package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.model.RuleResolutionStageResult
import com.japanese.vocabulary.translation.model.WordPreparationResult
import com.japanese.vocabulary.translation.service.pipeline.JapaneseText
import com.japanese.vocabulary.translation.service.pipeline.LexicalResolver
import org.springframework.stereotype.Component

@Component
class ResolveLexicalSensesStage(
    private val lexicalResolver: LexicalResolver,
) : PipelineStage<RuleResolutionStageResult, WordPreparationResult> {

    override suspend fun execute(input: RuleResolutionStageResult): WordPreparationResult {
        val unresolvedJapanese = input.tokensByIndex.values.flatten()
            .filter { JapaneseText.containsJapanese(it.surface) }
            .filterNot { input.ruleResolvedByKey.containsKey(it.key) }
        val lexical = lexicalResolver.resolve(unresolvedJapanese)

        return WordPreparationResult(
            segLines = input.segLines,
            tokensByIndex = input.tokensByIndex,
            ruleResolvedByKey = input.ruleResolvedByKey,
            lexical = lexical,
        )
    }
}
