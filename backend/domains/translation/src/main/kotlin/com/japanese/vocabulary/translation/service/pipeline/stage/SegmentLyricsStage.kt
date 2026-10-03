package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.model.AnalysisDefect
import com.japanese.vocabulary.translation.model.AnalysisDefectCause
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.SegmentationStageResult
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
import com.japanese.vocabulary.translation.model.UncoveredRun
import com.japanese.vocabulary.translation.service.pipeline.AnalysisDefectReporter
import com.japanese.vocabulary.translation.service.pipeline.ChunkedGeminiCall
import com.japanese.vocabulary.translation.service.pipeline.GluedParticleSplitter
import com.japanese.vocabulary.translation.service.pipeline.JapaneseText
import com.japanese.vocabulary.translation.service.pipeline.LexicalResolver
import com.japanese.vocabulary.translation.service.pipeline.RuleMeaningProvider
import com.japanese.vocabulary.translation.service.pipeline.SegmentAnchoringValidator
import com.japanese.vocabulary.translation.service.pipeline.SegmentationValidationException
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class SegmentLyricsStage(
    private val geminiClient: GeminiClient,
    private val segmentAnchoringValidator: SegmentAnchoringValidator,
    private val gluedParticleSplitter: GluedParticleSplitter,
    private val ruleMeaningProvider: RuleMeaningProvider,
    private val lexicalResolver: LexicalResolver,
    private val defectReporter: AnalysisDefectReporter,
) : PipelineStage<TranslationPipelineSource, SegmentationStageResult> {
    private val logger = LoggerFactory.getLogger(SegmentLyricsStage::class.java)

    /**
     * Segments every lyric line, splits glued particles out of the result, and retries **only the
     * lines that failed a check**; clean lines are kept across attempts so they cannot regress.
     *
     * Each attempt is split into [SEGMENT_CHUNK_LINES]-line calls to bound response length. The
     * order is *chunked call → anchor the whole attempt → collect failing lines → retry those,
     * also chunked*, so the retry set is line-scoped.
     *
     * - **Anchoring** ([SegmentAnchoringValidator]) *position* failures are fatal (every offset in
     *   the line is meaningless): retried to exhaustion, then thrown.
     * - **Completeness and headword resolvability** are not worth failing the song over: text no
     *   surface claimed (`晴れ舞台（イェイ）` → `晴れ舞台`) renders without a word card, and an
     *   unanswerable headword (`帰れない` for `帰る`) ships with no meaning. Both get one resampled
     *   retry; after [MAX_DEFECT_RETRIES] the best attempt is kept and each defect is reported
     *   through [AnalysisDefectReporter].
     * - A headword the dictionary **never answered** is kept the same way but reported as
     *   [AnalysisDefectCause.PROVIDER_ERROR] (jisho was down): the retry resends the line without
     *   feedback, which asks jisho again since errors are not cached.
     */
    override suspend fun execute(input: TranslationPipelineSource): SegmentationStageResult {
        val acceptedTokens = mutableMapOf<Int, List<PipelineToken>>()
        val acceptedSegLines = mutableMapOf<Int, SegLineDto>()
        val acceptedDefects = mutableMapOf<Int, LineDefects>()
        var pendingByIndex = input.rawByIndex
        var anchorFailures: Map<Int, String> = emptyMap()
        // Null feedback still resends the line, which makes the jisho lookup happen again.
        var defectFeedback: Map<Int, String?> = emptyMap()
        var defectRetriesLeft = MAX_DEFECT_RETRIES

        repeat(MAX_SEGMENTATION_ATTEMPTS) { attempt ->
            val segmented = segment(input, pendingByIndex, anchorFailures + defectFeedback, attempt)
            val anchored = segmentAnchoringValidator.anchor(pendingByIndex, segmented)
            val splitByIndex = gluedParticleSplitter.split(anchored.anchoredByIndex)
            val missesByIndex = headwordMisses(splitByIndex)
            val segLineByIndex = segmented.associateBy { it.index }

            splitByIndex.forEach { (index, tokens) ->
                val defects = LineDefects(
                    unresolvedHeadwords = missesByIndex[index].orEmpty(),
                    uncovered = anchored.incompleteByIndex[index],
                )
                val accepted = acceptedDefects[index]
                // Keep the attempt with fewer defects; a resample is not automatically better.
                if (accepted == null || defects.count < accepted.count) {
                    acceptedTokens[index] = tokens
                    acceptedDefects[index] = defects
                    segLineByIndex[index]?.let { acceptedSegLines[index] = it }
                }
            }

            // A defect retry can come back unanchorable; that is fatal only if no earlier version was accepted.
            anchorFailures = anchored.failuresByIndex.filterKeys { it !in acceptedTokens }
            val defectiveByIndex = acceptedDefects.filterValues { !it.isClean }
            val retryDefects = defectiveByIndex.isNotEmpty() && defectRetriesLeft > 0
            if (anchorFailures.isEmpty() && !retryDefects) {
                return finish(input, acceptedSegLines, acceptedTokens, defectiveByIndex)
            }

            defectFeedback = if (retryDefects) {
                defectRetriesLeft -= 1
                defectiveByIndex.mapValues { (_, defects) -> defects.retryMessage() }
            } else {
                emptyMap()
            }
            pendingByIndex = input.rawByIndex.filterKeys { it in anchorFailures || it in defectFeedback }
            logger.warn(
                "Segmentation attempt {}/{}: {} line(s) failed anchoring, {} line(s) came back " +
                    "incomplete, retrying those only: {}",
                attempt + 1,
                MAX_SEGMENTATION_ATTEMPTS,
                anchorFailures.size,
                defectFeedback.size,
                describeFailures(anchorFailures + defectFeedback),
            )
        }

        // Only position failures reach here; defects stop retrying inside the loop.
        if (anchorFailures.isEmpty() && acceptedTokens.keys.containsAll(input.rawByIndex.keys)) {
            return finish(input, acceptedSegLines, acceptedTokens, acceptedDefects.filterValues { !it.isClean })
        }
        throw SegmentationValidationException(
            "Segmentation validation failed for ${anchorFailures.size} line(s) after " +
                "$MAX_SEGMENTATION_ATTEMPTS attempts: ${describeFailures(anchorFailures)}",
        )
    }

    /**
     * One segmentation call per attempt, with **duplicate lines asked about once**.
     *
     * Asking for each repeated chorus line separately let the same text come back segmented two ways
     * (`雨が降り止むまでは帰れない`); sending distinct texts and copying each answer onto every index
     * keeps repeats consistent.
     *
     * Retries send only the failed lines, each with its own feedback.
     */
    private suspend fun segment(
        input: TranslationPipelineSource,
        pendingByIndex: Map<Int, String>,
        feedbackByIndex: Map<Int, String?>,
        attempt: Int,
    ): List<SegLineDto> {
        val representativeByText = linkedMapOf<String, Int>()
        pendingByIndex.forEach { (index, text) -> representativeByText.putIfAbsent(text, index) }
        val representatives = representativeByText.values.toSet()

        val request = input.lineInput
            .filter { line -> line[INDEX_FIELD] in representatives }
            .map { line -> line + retryFields(feedbackByIndex[line[INDEX_FIELD]]) }
        val segmented = ChunkedGeminiCall.flatMap(request, SEGMENT_CHUNK_LINES) { chunk ->
            geminiClient.segmentAndLemmatize(chunk, input.callContext, temperatureFor(attempt))
        }

        val segmentedByIndex = segmented.associateBy { it.index }
        return pendingByIndex.mapNotNull { (index, text) ->
            val representative = representativeByText[text] ?: return@mapNotNull null
            val line = segmentedByIndex[representative] ?: return@mapNotNull null
            if (line.index == index) line else line.copy(index = index)
        }
    }

    private fun retryFields(feedback: String?): Map<String, Any?> = when (feedback) {
        null -> emptyMap()
        else -> mapOf(
            PREVIOUS_VALIDATION_ERROR_FIELD to feedback,
            RETRY_INSTRUCTION_FIELD to RETRY_INSTRUCTION,
        )
    }

    /**
     * The tokens per line whose headword the dictionary cannot answer.
     *
     * Grammar comes first: [RuleMeaningProvider] settles particles and auxiliaries without a
     * dictionary, so `は` and `ている` would otherwise be reported. The rewrite is applied here only
     * to decide what to check ([ApplyRuleMeaningsStage] applies it for real); jisho caches.
     *
     * Exempt: katakana-only surfaces (`ステンバイミー`, `チリン`), where a retry cannot help, and a
     * headword with no Japanese in it (`あいうぉんちゅー` → "I want you"), which a Japanese
     * dictionary cannot confirm.
     */
    private suspend fun headwordMisses(
        tokensByIndex: Map<Int, List<PipelineToken>>,
    ): Map<Int, List<LexicalResolver.Unresolved>> {
        val checkable = tokensByIndex.values
            .flatMap { tokens -> ruleMeaningProvider.rewrite(tokens) }
            .filter { JapaneseText.containsJapanese(it.surface) }
            .filterNot { JapaneseText.isKatakanaOnly(it.surface) }
            .filter { JapaneseText.containsJapanese(it.headword) }
            .filter { ruleMeaningProvider.resolve(it) == null }
        if (checkable.isEmpty()) return emptyMap()
        return lexicalResolver.unresolvedTokens(checkable).groupBy { it.token.lineIndex }
    }

    /**
     * Reports what the lines still hold after the retry budget is spent, then returns the result.
     * Nothing downstream can tell a missing meaning or word from a legitimate absence, so this is
     * the only place that says so: one [AnalysisDefect] per token.
     */
    private fun finish(
        input: TranslationPipelineSource,
        segLines: Map<Int, SegLineDto>,
        tokens: Map<Int, List<PipelineToken>>,
        defectsByIndex: Map<Int, LineDefects>,
    ): SegmentationStageResult {
        val defects = defectsByIndex.entries.sortedBy { it.key }.flatMap { (index, lineDefects) ->
            lineDefects.toAnalysisDefects(input, index)
        }
        defectReporter.reportAll(defects)
        return SegmentationStageResult(
            segLines = input.rawByIndex.keys.map { segLines.getValue(it) },
            tokensByIndex = input.rawByIndex.keys.associateWith { tokens.getValue(it) },
        )
    }

    /**
     * The two ways a kept line can fall short of the raw line: a headword the dictionary cannot
     * answer, and Japanese text no surface claimed. They share one retry budget; [count] decides
     * whether a resample was an improvement.
     */
    private data class LineDefects(
        val unresolvedHeadwords: List<LexicalResolver.Unresolved>,
        val uncovered: UncoveredRun?,
    ) {
        val count: Int get() = unresolvedHeadwords.size + if (uncovered == null) 0 else 1

        val isClean: Boolean get() = count == 0

        /**
         * Feedback for the model. A headword jisho never answered is left out (it may be right, and
         * the feedback would push the model to invent another); the line is still resent.
         */
        fun retryMessage(): String? =
            listOfNotNull(unresolvedHeadwordMessage(), uncovered?.message).joinToString(". ").ifEmpty { null }

        fun toAnalysisDefects(input: TranslationPipelineSource, lineIndex: Int): List<AnalysisDefect> {
            val line = input.rawByIndex[lineIndex].orEmpty()
            val headwords = unresolvedHeadwords.map { (token, providerError) ->
                AnalysisDefect(
                    songId = input.callContext.songId,
                    lyricId = input.callContext.lyricId,
                    lineIndex = lineIndex,
                    cause = if (providerError) AnalysisDefectCause.PROVIDER_ERROR else AnalysisDefectCause.DICTIONARY_MISS,
                    surface = token.surface,
                    headword = token.headword,
                    line = line,
                )
            }
            val uncoveredText = uncovered?.let {
                AnalysisDefect(
                    songId = input.callContext.songId,
                    lyricId = input.callContext.lyricId,
                    lineIndex = lineIndex,
                    cause = AnalysisDefectCause.UNCOVERED,
                    surface = it.text,
                    headword = null,
                    line = line,
                )
            }
            return headwords + listOfNotNull(uncoveredText)
        }

        private fun unresolvedHeadwordMessage(): String? {
            val dictionaryMisses = unresolvedHeadwords.filterNot { it.providerError }.map { it.token }
            if (dictionaryMisses.isEmpty()) return null
            val named = dictionaryMisses.take(FAILURE_DETAIL_LIMIT)
                .joinToString(", ") { "'${it.headword}' (surface '${it.surface}')" }
            val omitted = dictionaryMisses.size - FAILURE_DETAIL_LIMIT
            val suffix = if (omitted > 0) " (+$omitted more)" else ""
            return "No jisho dictionary entry exists for headword $named$suffix"
        }
    }

    /**
     * Retries sample; the first attempt does not.
     *
     * At temperature 0 a retry reproduces the rejected output verbatim, so retries sample. It stays
     * low: a hot model invents readings.
     */
    private fun temperatureFor(attempt: Int): Double =
        minOf(SEGMENT_MAX_TEMPERATURE, attempt * SEGMENT_TEMPERATURE_STEP)

    private fun describeFailures(failuresByIndex: Map<Int, String?>): String {
        val sorted = failuresByIndex.entries.sortedBy { it.key }
        val shown = sorted.take(FAILURE_DETAIL_LIMIT)
            .joinToString("; ") { "index=${it.key}: ${it.value ?: "dictionary lookup failed, resending"}" }
        val omitted = sorted.size - FAILURE_DETAIL_LIMIT
        return if (omitted > 0) "$shown (+$omitted more)" else shown
    }

    companion object {
        const val MAX_SEGMENTATION_ATTEMPTS = 4

        /**
         * How many attempts an incomplete line may cost. One: text the model will never treat as a
         * word (an ad-lib, a name) would otherwise spend the whole budget.
         */
        const val MAX_DEFECT_RETRIES = 1

        /** Lines per segmentation call; bounds response length so long songs cannot stop mid-array. */
        const val SEGMENT_CHUNK_LINES = 20

        /** Temperature added per retry: attempt 0 is deterministic, attempt 1 is 0.3, and so on. */
        const val SEGMENT_TEMPERATURE_STEP = 0.3

        const val SEGMENT_MAX_TEMPERATURE = 0.9
        private const val FAILURE_DETAIL_LIMIT = 3
        private const val UNRESOLVED_DETAIL_LIMIT = 10
        private const val INDEX_FIELD = "index"
        private const val PREVIOUS_VALIDATION_ERROR_FIELD = "previousValidationError"
        private const val RETRY_INSTRUCTION_FIELD = "retryInstruction"
        private const val RETRY_INSTRUCTION =
            "The previous segmentation output failed validator checks for this line. " +
                // Names the rules the validator enforces, in its order; a vague retry gets the same array back.
                "Every surface must be an exact substring of this line's text, cut from it without " +
                "changing a character, and the surfaces must appear in the line's own order. " +
                // An invented space matches the next real space and drags the anchor past the words between.
                "Output Japanese words only — no whitespace, punctuation, quote, latin or digit tokens, " +
                "and never a separator that is not in the text. Gaps between surfaces are expected. " +
                "Every Japanese character of the line must fall inside some surface. " +
                // Without this, the rule above dropped kana wedged between digits (`140と30字の` lost `と`).
                "Only the digits and latin letters themselves are left out: kana or kanji between or " +
                "right after them is still a word (1と2の → と / の). " +
                // The validator rejects readings too.
                "usedReading and baseFormReading must be kana only — katakana preferred, no kanji, no " +
                "spaces, no punctuation, never empty. " +
                // Fixes the headword the dictionary check could not find.
                "Every headword must be the plain dictionary form of ONE word: not an inflected form " +
                "(帰れない → 帰る, 離れない → 離れる, できない → できる), not a form carrying a particle " +
                "(までは, 何を, こんなにも), and not two words joined (長くない → 長く / ない). Split such a " +
                "token into separate surfaces, each with its own headword: までは → まで + は. " +
                // Guards against a split headword with a glued surface, which claims the particle's kana twice.
                "Every character of the line belongs to exactly one surface. " +
                // Uncovered-text feedback arrives through this same instruction.
                "Japanese inside brackets is lyric too: drop the brackets, keep the words. " +
                "Return exactly the lines given in this input, with the same index values."
    }
}
