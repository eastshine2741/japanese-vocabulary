package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.SelectLineDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.model.AnalysisDefect
import com.japanese.vocabulary.translation.model.AnalysisDefectCause
import com.japanese.vocabulary.translation.model.PipelineSenseOption
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.PipelineTokenKey
import com.japanese.vocabulary.translation.model.SenseSelectionStageInput
import com.japanese.vocabulary.translation.service.pipeline.AnalysisDefectReporter
import com.japanese.vocabulary.translation.service.pipeline.ChunkedGeminiCall
import com.japanese.vocabulary.translation.service.pipeline.JapaneseText
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class SelectSensesStage(
    private val geminiClient: GeminiClient,
    private val defectReporter: AnalysisDefectReporter,
) : PipelineStage<SenseSelectionStageInput, Map<PipelineTokenKey, Int>> {
    private val logger = LoggerFactory.getLogger(SelectSensesStage::class.java)

    override suspend fun execute(input: SenseSelectionStageInput): Map<PipelineTokenKey, Int> {
        val wordPreparation = input.wordPreparation
        val lexical = wordPreparation.lexical
        val candidateTokensByIndex = wordPreparation.tokensByIndex.mapValues { (_, tokens) ->
            tokens.filter { token ->
                JapaneseText.containsJapanese(token.surface) &&
                    !wordPreparation.ruleResolvedByKey.containsKey(token.key) &&
                    lexical.byTokenKey[token.key]?.options?.isNotEmpty() == true
            }
        }.filterValues { it.isNotEmpty() }

        // A word with one candidate sense has nothing to choose between. Now that entry narrowing
        // usually leaves a single entry, this is the common case, and asking the model to confirm it
        // would be paying for an answer that is already determined.
        val settledSenseByKey = candidateTokensByIndex.values.flatten()
            .mapNotNull { token ->
                lexical.byTokenKey.getValue(token.key).options.singleOrNull()?.let { token.key to it.senseId }
            }.toMap()

        val selectableTokensByIndex = candidateTokensByIndex
            .mapValues { (_, tokens) -> tokens.filterNot { it.key in settledSenseByKey } }
            .filterValues { it.isNotEmpty() }
        if (selectableTokensByIndex.isEmpty()) return settledSenseByKey

        val selectedLines = ChunkedGeminiCall.flatMap(selectInput(selectableTokensByIndex, input), SELECT_CHUNK_LINES) {
            geminiClient.selectSenses(it, input.source.callContext)
        }
        val firstByIndex = validateLineIndices(selectableTokensByIndex.keys, selectedLines)
        val selectByIndex = retryMissingTokens(selectableTokensByIndex, firstByIndex, input)
        return settledSenseByKey + selectedSenseByKey(selectableTokensByIndex, selectByIndex, input)
    }

    /**
     * Asks once more for the tokens the first response left unanswered. A response sometimes drops
     * most of a line at once (song 223 lost 歌え/最高/波/音 in one answer); the same tokens asked on
     * their own usually come back. Retry answers only fill tokens that were missing, and a retry that
     * still leaves them out falls through to [selectedSenseByKey], which reports them.
     */
    private suspend fun retryMissingTokens(
        selectableTokensByIndex: Map<Int, List<PipelineToken>>,
        selectByIndex: Map<Int, SelectLineDto>,
        input: SenseSelectionStageInput,
    ): Map<Int, SelectLineDto> {
        val missingTokensByIndex = selectableTokensByIndex.mapValues { (index, tokens) ->
            val answered = selectByIndex[index]?.words.orEmpty().map { it.tokenId }.toSet()
            tokens.filterNot { it.key.tokenId in answered }
        }.filterValues { it.isNotEmpty() }
        if (missingTokensByIndex.isEmpty()) return selectByIndex

        logger.warn(
            "[songId={}] Sense-select left tokens unanswered, retrying those only: {}",
            input.source.callContext.songId,
            missingTokensByIndex.mapValues { (_, tokens) -> tokens.map { it.key.tokenId } },
        )
        val retryLines = ChunkedGeminiCall.flatMap(selectInput(missingTokensByIndex, input), SELECT_CHUNK_LINES) {
            geminiClient.selectSenses(it, input.source.callContext)
        }
        val retryWordsByIndex = retryLines.groupBy({ it.index }, { it.words })
        return selectByIndex.mapValues { (index, line) ->
            val missingIds = missingTokensByIndex[index].orEmpty().map { it.key.tokenId }.toSet()
            if (missingIds.isEmpty()) return@mapValues line
            val recovered = retryWordsByIndex[index].orEmpty().flatten()
                .filter { it.tokenId in missingIds }
                .distinctBy { it.tokenId }
            line.copy(words = line.words + recovered)
        }
    }

    private fun selectInput(
        tokensByIndex: Map<Int, List<PipelineToken>>,
        input: SenseSelectionStageInput,
    ): List<Map<String, Any?>> {
        val lexical = input.wordPreparation.lexical
        return tokensByIndex.map { (index, tokens) ->
            mapOf(
                "index" to index,
                "japanese" to (input.source.rawByIndex[index] ?: ""),
                "korean" to (input.translationMap[index]?.koreanLyrics ?: ""),
                "segments" to tokens.map { token ->
                    val resolved = lexical.byTokenKey.getValue(token.key)
                    buildMap {
                        put("tokenId", token.key.tokenId)
                        put("surface", token.surface)
                        put("headword", resolved.baseForm)
                        // An empty gloss is worse than none: the prompt tells the model to match
                        // against it, and matching against "" is noise.
                        token.contextGloss.takeIf { it.isNotBlank() }?.let { put("contextGloss", it) }
                        put("senses", resolved.options.map(::senseCandidate))
                    }
                },
            )
        }
    }

    /**
     * One sense candidate as the LLM sees it.
     *
     * Headword and reading are sent only for [JishoLookupProvenance.AMBIGUOUS_HEADWORD], the one grade
     * where senses from more than one dictionary entry share a request — there they are what makes
     * 前[マエ]'s "before / earlier" distinguishable from 前[ゼン]'s. Every other grade has already been
     * narrowed to a single entry, so repeating its headword and reading on each sense would restate a
     * constant the model cannot act on.
     *
     * `englishDefinitions` is deliberately absent: [PipelineSenseOption.english] is that same list
     * joined with " / ", so sending both duplicated every gloss in the request.
     */
    private fun senseCandidate(option: PipelineSenseOption): Map<String, Any?> = buildMap {
        put("senseId", option.senseId)
        if (option.provenance == JishoLookupProvenance.AMBIGUOUS_HEADWORD) {
            option.headword?.let { put("headword", it) }
            option.reading?.let { put("reading", it) }
        }
        put("english", option.english)
        put("pos", option.rawPos.joinToString(" / "))
    }

    private fun selectedSenseByKey(
        selectableTokensByIndex: Map<Int, List<PipelineToken>>,
        selectByIndex: Map<Int, SelectLineDto>,
        input: SenseSelectionStageInput,
    ): Map<PipelineTokenKey, Int> {
        val lexical = input.wordPreparation.lexical
        return selectableTokensByIndex.flatMap { (index, tokens) ->
            val selectedWords = selectByIndex[index]?.words ?: emptyList()
            if (selectedWords.size != tokens.size) {
                logger.warn(
                    "Sense-select word count mismatch at line index={}: expected={}, actual={}",
                    index,
                    tokens.size,
                    selectedWords.size,
                )
            }
            // tokenId is lineIndex:charStart:charEnd:surface, so looking a token up by it pins the
            // token identity — no surface/headword echo needed. The model does not keep request
            // order reliably, so the position of an answer in the array says nothing.
            val selectedByTokenId = selectedWords.associateBy { it.tokenId }
            tokens.map { token ->
                val selected = selectedByTokenId[token.key.tokenId]
                val resolved = lexical.byTokenKey[token.key]
                val selectedSenseId = selected?.senseId ?: NO_SENSE
                val valid = selected != null &&
                    resolved != null &&
                    resolved.options.any { it.senseId == selectedSenseId }
                // Either way the token leaves with no sense at all, so it is a shipped defect and
                // reported as one — the word had candidates, and the model named one it was never
                // offered, or answered nothing for it.
                val offered = resolved?.options?.map { it.senseId }.orEmpty()
                val defect = when {
                    selected == null -> AnalysisDefectCause.SENSE_MISSING to
                        "tokenId=${token.key.tokenId}, offered=$offered"
                    // The prompt tells the model to answer -1 when none of the offered senses fits the
                    // line. That is the designed answer, not a rejected one: チク in 「チクタクチク」 is
                    // a clock's tick, and none of 竹/築/地区 is, so the model saying so is not a defect.
                    selectedSenseId == NO_SENSE -> null
                    !valid -> AnalysisDefectCause.SENSE_REJECTED to
                        "tokenId=${token.key.tokenId}, selectedSenseId=$selectedSenseId, offered=$offered"
                    else -> null
                }
                defect?.let { (cause, detail) ->
                    defectReporter.report(
                        AnalysisDefect(
                            songId = input.source.callContext.songId,
                            lyricId = input.source.callContext.lyricId,
                            lineIndex = index,
                            cause = cause,
                            surface = token.surface,
                            headword = token.headword,
                            line = input.source.rawByIndex[index].orEmpty(),
                            detail = detail,
                        ),
                    )
                }
                token.key to if (valid) selectedSenseId else NO_SENSE
            }
        }.toMap()
    }

    private fun validateLineIndices(
        expectedIndices: Set<Int>,
        selectedLines: List<SelectLineDto>,
    ): Map<Int, SelectLineDto> {
        val actualIndices = selectedLines.map { it.index }
        val duplicated = actualIndices.groupingBy { it }.eachCount().filterValues { it > 1 }.keys
        if (duplicated.isNotEmpty()) {
            throw IllegalStateException("Sense-select returned duplicate line indices: $duplicated")
        }
        val actualSet = actualIndices.toSet()
        if (actualSet != expectedIndices) {
            throw IllegalStateException(
                "Sense-select line indices mismatch: expected=$expectedIndices actual=$actualSet",
            )
        }
        return selectedLines.associateBy { it.index }
    }

    companion object {
        /** Lines per sense-select call. Bounds response length so long songs cannot stop mid-array. */
        const val SELECT_CHUNK_LINES = 20

        /** The senseId the prompt reserves for "no offered sense fits this line". */
        const val NO_SENSE = -1
    }
}
