package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.SegmentationStageResult
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
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
) : PipelineStage<TranslationPipelineSource, SegmentationStageResult> {
    private val logger = LoggerFactory.getLogger(SegmentLyricsStage::class.java)

    /**
     * Segments every lyric line, splits glued particles out of the result, and retries **only the
     * lines that failed a check**. Lines that came back clean are kept across attempts, so one bad
     * line cannot discard the rest or make an already-correct line regress on a later attempt.
     *
     * Each attempt is itself split into [SEGMENT_CHUNK_LINES]-line calls. The per-word payload grew
     * from two fields to five (two readings and a gloss), so a whole-song response is now long enough
     * to stop mid-array; chunking bounds each response instead. The order stays
     * *chunked call → anchor the whole attempt → collect the failing lines → retry those, also
     * chunked*, which keeps the retry set line-scoped rather than chunk-scoped.
     *
     * Two checks decide a line, and they are not equally severe:
     *
     * - **Anchoring** ([SegmentAnchoringValidator]) is structural, but only its *position* failures
     *   are fatal. A surface the line does not hold, or one out of order, makes every offset in the
     *   line meaningless, so those are retried to exhaustion and then throw.
     * - **Completeness and headword resolvability** are both "the model gave us less than the line
     *   holds", and neither is worth failing the song over. Text no surface claimed
     *   (`晴れ舞台（イェイ）` → `晴れ舞台`) still renders from the raw line, just without a word card; a
     *   headword the dictionary cannot answer (`帰れない` for `帰る`) reaches the app with no meaning.
     *   Both get one resampled retry — the same line often comes back right, since it was segmented
     *   correctly elsewhere in the same song — and after [MAX_DEFECT_RETRIES] the best attempt is kept
     *   and the defect is logged.
     */
    override suspend fun execute(input: TranslationPipelineSource): SegmentationStageResult {
        val acceptedTokens = mutableMapOf<Int, List<PipelineToken>>()
        val acceptedSegLines = mutableMapOf<Int, SegLineDto>()
        val acceptedDefects = mutableMapOf<Int, LineDefects>()
        var pendingByIndex = input.rawByIndex
        var anchorFailures: Map<Int, String> = emptyMap()
        var defectFeedback: Map<Int, String> = emptyMap()
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
                // A resampled retry is not automatically better. Keep the attempt with fewer defects,
                // or a line retried for one bad token could come back with three.
                if (accepted == null || defects.count < accepted.count) {
                    acceptedTokens[index] = tokens
                    acceptedDefects[index] = defects
                    segLineByIndex[index]?.let { acceptedSegLines[index] = it }
                }
            }

            // A line retried for a defect can come back unanchorable. That is not fatal — the earlier
            // attempt is still held — so only a line with no accepted version at all counts as an
            // anchoring failure.
            anchorFailures = anchored.failuresByIndex.filterKeys { it !in acceptedTokens }
            val defectiveByIndex = acceptedDefects.filterValues { !it.isClean }
            val retryDefects = defectiveByIndex.isNotEmpty() && defectRetriesLeft > 0
            if (anchorFailures.isEmpty() && !retryDefects) {
                reportDefects(input, defectiveByIndex)
                return result(input, acceptedSegLines, acceptedTokens)
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

        // Position failures are the only check that gets here: a defect stops asking once its retry
        // budget is spent, which is inside the loop.
        if (anchorFailures.isEmpty() && acceptedTokens.keys.containsAll(input.rawByIndex.keys)) {
            reportDefects(input, acceptedDefects.filterValues { !it.isClean })
            return result(input, acceptedSegLines, acceptedTokens)
        }
        throw SegmentationValidationException(
            "Segmentation validation failed for ${anchorFailures.size} line(s) after " +
                "$MAX_SEGMENTATION_ATTEMPTS attempts: ${describeFailures(anchorFailures)}",
        )
    }

    /**
     * One segmentation call per attempt, with **duplicate lines asked about once**.
     *
     * A chorus repeats whole lines, and asking for each occurrence separately let the same text come
     * back segmented two different ways: `雨が降り止むまでは帰れない` resolved on one line while the other
     * gave `までは` and `帰れない` as their own headwords and lost both meanings. Sending the distinct
     * texts and copying each answer onto every index that holds it makes repeats consistent by
     * construction, and shortens the request.
     *
     * Retries send only the lines that failed, each carrying its own feedback so it cannot leak into
     * an unrelated line.
     */
    private suspend fun segment(
        input: TranslationPipelineSource,
        pendingByIndex: Map<Int, String>,
        feedbackByIndex: Map<Int, String>,
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
     * dictionary, so checking before it runs would report `は` and `ている` as missing words. The rewrite
     * is applied here only to decide what to check — [ApplyRuleMeaningsStage] applies it for real to
     * whatever this stage returns — and jisho caches, so asking early costs one Redis hit.
     *
     * Katakana-only surfaces are exempt: `ステンバイミー` and `チリン` have no dictionary entry to find, so
     * retrying them would spend the budget on the one case a retry cannot fix.
     */
    private suspend fun headwordMisses(tokensByIndex: Map<Int, List<PipelineToken>>): Map<Int, List<PipelineToken>> {
        val checkable = tokensByIndex.values
            .flatMap { tokens -> ruleMeaningProvider.rewrite(tokens) }
            .filter { JapaneseText.containsJapanese(it.surface) }
            .filterNot { JapaneseText.isKatakanaOnly(it.surface) }
            .filter { ruleMeaningProvider.resolve(it) == null }
        if (checkable.isEmpty()) return emptyMap()
        return lexicalResolver.unresolvedTokens(checkable).groupBy { it.lineIndex }
    }

    private fun result(
        input: TranslationPipelineSource,
        segLines: Map<Int, SegLineDto>,
        tokens: Map<Int, List<PipelineToken>>,
    ) = SegmentationStageResult(
        segLines = input.rawByIndex.keys.map { segLines.getValue(it) },
        tokensByIndex = input.rawByIndex.keys.associateWith { tokens.getValue(it) },
    )

    /**
     * What the lines still hold after the retry budget is spent. Nothing downstream can tell a token
     * with no meaning from one that legitimately has none, or a line that lost a word from one that
     * never had it, so this is the only place the pipeline says either out loud.
     */
    private fun reportDefects(input: TranslationPipelineSource, defectsByIndex: Map<Int, LineDefects>) {
        if (defectsByIndex.isEmpty()) return
        val unresolved = defectsByIndex.values.flatMap { it.unresolvedHeadwords }
        if (unresolved.isNotEmpty()) {
            logger.warn(
                "[songId={}] {} token(s) on {} line(s) keep an unresolvable headword and will have no meaning: {}",
                input.callContext.songId,
                unresolved.size,
                defectsByIndex.count { it.value.unresolvedHeadwords.isNotEmpty() },
                unresolved.take(UNRESOLVED_DETAIL_LIMIT).joinToString(", ") { "'${it.surface}'(${it.headword})" },
            )
        }
        val uncovered = defectsByIndex.filterValues { it.uncovered != null }
        if (uncovered.isNotEmpty()) {
            logger.warn(
                "[songId={}] {} line(s) leave Japanese text outside every surface, so it carries no word: {}",
                input.callContext.songId,
                uncovered.size,
                uncovered.entries.sortedBy { it.key }.take(FAILURE_DETAIL_LIMIT)
                    .joinToString("; ") { it.value.uncovered.orEmpty() },
            )
        }
    }

    /**
     * The two ways a kept line can be short of what the raw line holds — a headword the dictionary
     * cannot answer, and Japanese text no surface claimed. Both cost the reader a word rather than the
     * whole song, so they share one retry budget and one comparison: [count] is what decides whether a
     * resample was an improvement.
     */
    private data class LineDefects(
        val unresolvedHeadwords: List<PipelineToken>,
        val uncovered: String?,
    ) {
        val count: Int get() = unresolvedHeadwords.size + if (uncovered == null) 0 else 1

        val isClean: Boolean get() = count == 0

        fun retryMessage(): String = listOfNotNull(unresolvedHeadwordMessage(), uncovered).joinToString(". ")

        private fun unresolvedHeadwordMessage(): String? {
            if (unresolvedHeadwords.isEmpty()) return null
            val named = unresolvedHeadwords.take(FAILURE_DETAIL_LIMIT)
                .joinToString(", ") { "'${it.headword}' (surface '${it.surface}')" }
            val omitted = unresolvedHeadwords.size - FAILURE_DETAIL_LIMIT
            val suffix = if (omitted > 0) " (+$omitted more)" else ""
            return "No jisho dictionary entry exists for headword $named$suffix"
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

        /**
         * How many attempts an incomplete line may cost. One: a resampled line does sometimes come
         * back with the dictionary form, or with the word it skipped, but text the model will never
         * treat as a word — a parenthesized ad-lib, a name no dictionary holds — would otherwise spend
         * the whole budget and take the song's analysis down with it.
         */
        const val MAX_DEFECT_RETRIES = 1

        /** Lines per segmentation call. Bounds response length so long songs cannot stop mid-array. */
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
                "spaces, no punctuation, never empty. " +
                // The dictionary check's feedback names the headword it could not find; this is the
                // rule that fixes it.
                "Every headword must be the plain dictionary form of ONE word: not an inflected form " +
                "(帰れない → 帰る, 離れない → 離れる, できない → できる), not a form carrying a particle " +
                "(までは, 何を, こんなにも), and not two words joined (長くない → 長く / ない). Split such a " +
                "token into separate surfaces, each with its own headword: までは → まで + は. " +
                // How the previous prompt was misread: headword split, surface left glued, particle
                // emitted a second time — so its kana was claimed twice and the line could not anchor.
                "Every character of the line belongs to exactly one surface. " +
                // Uncovered-text feedback arrives through this same instruction.
                "Japanese inside brackets is lyric too: drop the brackets, keep the words. " +
                "Return exactly the lines given in this input, with the same index values."
    }
}
