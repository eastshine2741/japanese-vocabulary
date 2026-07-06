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
        var retryInput = input.lineInput
        repeat(MAX_SEGMENTATION_ATTEMPTS) { attempt ->
            val segmented = geminiClient.segmentAndLemmatize(retryInput)
            try {
                val anchoredTokens = segmentAnchoringValidator.validate(input.rawByIndex, segmented)
                return SegmentationStageResult(
                    segLines = segmented,
                    tokensByIndex = anchoredTokens,
                )
            } catch (e: SegmentationValidationException) {
                lastFailure = e
                retryInput = input.lineInput.withValidationFeedback(e.message ?: "Segmentation validation failed")
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

    private fun List<Map<String, Any?>>.withValidationFeedback(message: String): List<Map<String, Any?>> =
        map { line ->
            line + mapOf(
                PREVIOUS_VALIDATION_ERROR_FIELD to message,
                RETRY_INSTRUCTION_FIELD to RETRY_INSTRUCTION,
            )
        }

    private companion object {
        const val MAX_SEGMENTATION_ATTEMPTS = 2
        const val PREVIOUS_VALIDATION_ERROR_FIELD = "previousValidationError"
        const val RETRY_INSTRUCTION_FIELD = "retryInstruction"
        const val RETRY_INSTRUCTION =
            "The previous segmentation output failed validator checks. " +
                "Fix the segmentation so every surface appears in order and all original Japanese text is covered."
    }
}
