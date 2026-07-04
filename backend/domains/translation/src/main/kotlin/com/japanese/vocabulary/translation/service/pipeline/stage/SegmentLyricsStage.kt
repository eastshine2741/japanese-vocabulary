package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.model.SegmentationStageResult
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
import com.japanese.vocabulary.translation.service.pipeline.SegmentAnchoringValidator
import com.japanese.vocabulary.translation.service.pipeline.SegmentationValidationException
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class SegmentLyricsStage(
    private val geminiClient: GeminiClient,
    private val segmentAnchoringValidator: SegmentAnchoringValidator,
) : PipelineStage<TranslationPipelineSource, SegmentationStageResult> {
    private val logger = LoggerFactory.getLogger(SegmentLyricsStage::class.java)

    override suspend fun execute(input: TranslationPipelineSource): SegmentationStageResult {
        var lastFailure: SegmentationValidationException? = null
        repeat(MAX_SEGMENTATION_ATTEMPTS) { attempt ->
            val segmented = geminiClient.segmentAndLemmatize(input.lineInput)
            try {
                return SegmentationStageResult(
                    segLines = segmented,
                    tokensByIndex = segmentAnchoringValidator.validate(input.rawByIndex, segmented),
                )
            } catch (e: SegmentationValidationException) {
                lastFailure = e
                logger.warn(
                    "Segmentation surface validation failed on attempt {}/{}: {}",
                    attempt + 1,
                    MAX_SEGMENTATION_ATTEMPTS,
                    e.message,
                )
            }
        }
        throw lastFailure ?: SegmentationValidationException("Segmentation validation failed")
    }

    private companion object {
        const val MAX_SEGMENTATION_ATTEMPTS = 2
    }
}
