package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.SegmentationStageResult
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
import com.japanese.vocabulary.translation.service.pipeline.ChunkedGeminiCall
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

    /**
     * Segments every lyric line, then retries **only the lines that failed anchoring**. Lines that
     * anchored cleanly are kept across attempts, so one bad line cannot discard the rest or make an
     * already-correct line regress on a later attempt.
     *
     * Each attempt is itself split into [SEGMENT_CHUNK_LINES]-line calls. The per-word payload grew
     * from two fields to five (two readings and a gloss), so a whole-song response is now long enough
     * to stop mid-array; chunking bounds each response instead. The order stays
     * *chunked call → anchor the whole attempt → collect the failing lines → retry those, also
     * chunked*, which keeps the retry set line-scoped rather than chunk-scoped.
     */
    override suspend fun execute(input: TranslationPipelineSource): SegmentationStageResult {
        val anchoredByIndex = mutableMapOf<Int, List<PipelineToken>>()
        val segLineByIndex = mutableMapOf<Int, SegLineDto>()
        var pendingByIndex = input.rawByIndex
        var failuresByIndex: Map<Int, String> = emptyMap()

        repeat(MAX_SEGMENTATION_ATTEMPTS) { attempt ->
            val segmented = ChunkedGeminiCall.flatMap(
                buildRequest(input, failuresByIndex),
                SEGMENT_CHUNK_LINES,
            ) { chunk -> geminiClient.segmentAndLemmatize(chunk, input.callContext, temperatureFor(attempt)) }
            val result = segmentAnchoringValidator.anchor(pendingByIndex, segmented)

            anchoredByIndex.putAll(result.anchoredByIndex)
            segmented.forEach { line ->
                if (line.index in result.anchoredByIndex) segLineByIndex[line.index] = line
            }
            failuresByIndex = result.failuresByIndex

            if (failuresByIndex.isEmpty()) {
                return SegmentationStageResult(
                    segLines = input.rawByIndex.keys.map { segLineByIndex.getValue(it) },
                    tokensByIndex = input.rawByIndex.keys.associateWith { anchoredByIndex.getValue(it) },
                )
            }

            pendingByIndex = input.rawByIndex.filterKeys { it in failuresByIndex }
            logger.info(
                "Segmentation surface validation failed on attempt {}/{}: {} of {} lines invalid, retrying those only: {}",
                attempt + 1,
                MAX_SEGMENTATION_ATTEMPTS,
                failuresByIndex.size,
                input.rawByIndex.size,
                describeFailures(failuresByIndex),
            )
        }

        throw SegmentationValidationException(
            "Segmentation validation failed for ${failuresByIndex.size} line(s) after " +
                "$MAX_SEGMENTATION_ATTEMPTS attempts: ${describeFailures(failuresByIndex)}",
        )
    }

    /**
     * First attempt sends every line as-is. Retries send only the failing lines, each carrying its own
     * validation error so the feedback cannot leak into unrelated lines.
     */
    private fun buildRequest(
        input: TranslationPipelineSource,
        failuresByIndex: Map<Int, String>,
    ): List<Map<String, Any?>> {
        if (failuresByIndex.isEmpty()) return input.lineInput
        return input.lineInput
            .filter { line -> line[INDEX_FIELD] in failuresByIndex.keys }
            .map { line ->
                line + mapOf(
                    PREVIOUS_VALIDATION_ERROR_FIELD to failuresByIndex.getValue(line[INDEX_FIELD] as Int),
                    RETRY_INSTRUCTION_FIELD to RETRY_INSTRUCTION,
                )
            }
    }

    /**
     * Retries sample; the first attempt does not.
     *
     * At temperature 0 the model is deterministic, so a retry whose only difference is two extra
     * fields reproduces the rejected output verbatim — three retries on `涼しい風吹く 青空の匂い` came
     * back byte-identical and burned every attempt. Sampling is what makes a second attempt a second
     * attempt. It stays low: this stage carries the pipeline's disambiguation signal and a hot model
     * invents readings.
     */
    private fun temperatureFor(attempt: Int): Double =
        minOf(SEGMENT_MAX_TEMPERATURE, attempt * SEGMENT_TEMPERATURE_STEP)

    private fun describeFailures(failuresByIndex: Map<Int, String>): String {
        val sorted = failuresByIndex.entries.sortedBy { it.key }
        val shown = sorted.take(FAILURE_DETAIL_LIMIT).joinToString("; ") { "index=${it.key}: ${it.value}" }
        val omitted = sorted.size - FAILURE_DETAIL_LIMIT
        return if (omitted > 0) "$shown (+$omitted more)" else shown
    }

    companion object {
        const val MAX_SEGMENTATION_ATTEMPTS = 4

        /** Lines per segmentation call. Bounds response length so long songs cannot stop mid-array. */
        const val SEGMENT_CHUNK_LINES = 20

        /** Temperature added per retry: attempt 0 is deterministic, attempt 1 is 0.3, and so on. */
        const val SEGMENT_TEMPERATURE_STEP = 0.3

        const val SEGMENT_MAX_TEMPERATURE = 0.9
        private const val FAILURE_DETAIL_LIMIT = 3
        private const val INDEX_FIELD = "index"
        private const val PREVIOUS_VALIDATION_ERROR_FIELD = "previousValidationError"
        private const val RETRY_INSTRUCTION_FIELD = "retryInstruction"
        private const val RETRY_INSTRUCTION =
            "The previous segmentation output failed validator checks for this line. " +
                // Naming the rules the validator actually enforces, in the order it enforces them.
                // A retry that only repeats "appears in order" leaves the model guessing which of its
                // words moved the anchor, and it answers by re-sending the same array.
                "Every surface must be an exact substring of this line's text, cut from it without " +
                "changing a character, and the surfaces must appear in the line's own order. " +
                // The failure this feedback exists for: an invented space matches the next real space
                // and drags the anchor past the words in between.
                "Output Japanese words only — no whitespace, punctuation, quote or latin tokens, and " +
                "never a separator that is not in the text. Gaps between surfaces are expected. " +
                "Every Japanese character of the line must fall inside some surface. " +
                // The validator rejects readings too, so a retry that only talks about surfaces steers
                // the model away from half the failures it is being asked to fix.
                "usedReading and baseFormReading must be kana only — katakana preferred, no kanji, no " +
                "spaces, no punctuation, never empty. Return exactly the lines given in this input, " +
                "with the same index values."
    }
}
