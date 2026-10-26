package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.model.RuleResolutionStageResult
import com.japanese.vocabulary.translation.model.SegmentationStageResult
import com.japanese.vocabulary.translation.service.pipeline.RuleMeaningProvider
import org.springframework.stereotype.Component

@Component
class ApplyRuleMeaningsStage(
    private val ruleMeaningProvider: RuleMeaningProvider,
) : PipelineStage<SegmentationStageResult, RuleResolutionStageResult> {

    override suspend fun execute(input: SegmentationStageResult): RuleResolutionStageResult {
        val tokensByIndex = input.tokensByIndex.mapValues { (_, tokens) -> ruleMeaningProvider.rewrite(tokens) }
        val ruleResolvedByKey = tokensByIndex.values.flatMap { tokens ->
            tokens.mapIndexedNotNull { i, token ->
                ruleMeaningProvider.resolve(token, tokens.getOrNull(i - 1))?.let { token.key to it }
            }
        }.toMap()

        return RuleResolutionStageResult(
            segLines = input.segLines,
            tokensByIndex = tokensByIndex,
            ruleResolvedByKey = ruleResolvedByKey,
        )
    }
}
