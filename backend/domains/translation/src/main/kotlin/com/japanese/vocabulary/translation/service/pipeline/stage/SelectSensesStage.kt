package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.SelectLineDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.model.PipelineSenseOption
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.PipelineTokenKey
import com.japanese.vocabulary.translation.model.SenseSelectionStageInput
import com.japanese.vocabulary.translation.service.pipeline.ChunkedGeminiCall
import com.japanese.vocabulary.translation.service.pipeline.JapaneseText
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class SelectSensesStage(
    private val geminiClient: GeminiClient,
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

        val selectInput = selectableTokensByIndex.map { (index, tokens) ->
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

        val selectedLines = ChunkedGeminiCall.flatMap(selectInput, SELECT_CHUNK_LINES) {
            geminiClient.selectSenses(it, input.source.callContext)
        }
        val selectByIndex = validateLineIndices(selectableTokensByIndex.keys, selectedLines)
        return settledSenseByKey + selectedSenseByKey(selectableTokensByIndex, selectByIndex, input)
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
            tokens.mapIndexed { i, token ->
                val selected = selectedWords.getOrNull(i)
                val resolved = lexical.byTokenKey[token.key]
                val selectedSenseId = selected?.senseId ?: -1
                // tokenId is lineIndex:charStart:charEnd:surface, so matching it pins the token
                // identity — no surface/headword echo needed.
                val valid = selected != null &&
                    selected.tokenId == token.key.tokenId &&
                    resolved != null &&
                    resolved.options.any { it.senseId == selectedSenseId }
                if (!valid && selected != null) {
                    logger.warn(
                        "Rejected invalid sense-select result at line index={}, tokenId={}, selectedSenseId={}",
                        index,
                        token.key.tokenId,
                        selectedSenseId,
                    )
                }
                token.key to if (valid) selectedSenseId else -1
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
    }
}
