package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.SelectLineDto
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.PipelineTokenKey
import com.japanese.vocabulary.translation.model.SenseSelectionStageInput
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
        val selectableTokensByIndex = wordPreparation.tokensByIndex.mapValues { (_, tokens) ->
            tokens.filter { token ->
                JapaneseText.containsJapanese(token.surface) &&
                    !wordPreparation.ruleResolvedByKey.containsKey(token.key) &&
                    lexical.byTokenKey[token.key]?.options?.isNotEmpty() == true
            }
        }.filterValues { it.isNotEmpty() }

        val selectInput = selectableTokensByIndex.map { (index, tokens) ->
            mapOf(
                "index" to index,
                "japanese" to (input.source.rawByIndex[index] ?: ""),
                "korean" to (input.translationMap[index]?.koreanLyrics ?: ""),
                "segments" to tokens.map { token ->
                    val resolved = lexical.byTokenKey.getValue(token.key)
                    mapOf(
                        "tokenId" to token.key.tokenId,
                        "surface" to token.surface,
                        "dictionaryForm" to resolved.baseForm,
                        "senses" to resolved.options.map { option ->
                            mapOf(
                                "senseId" to option.senseId,
                                "english" to option.english,
                                "englishDefinitions" to option.englishDefinitions,
                                "pos" to option.rawPos.joinToString(" / "),
                            )
                        },
                    )
                },
            )
        }
        if (selectInput.isEmpty()) return emptyMap()

        val selectedLines = geminiClient.selectSenses(selectInput)
        val selectByIndex = validateLineIndices(selectableTokensByIndex.keys, selectedLines)
        return selectedSenseByKey(selectableTokensByIndex, selectByIndex, input)
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
                val valid = selected != null &&
                    selected.tokenId == token.key.tokenId &&
                    selected.surface == token.surface &&
                    selected.dictionaryForm == resolved?.baseForm &&
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
}
