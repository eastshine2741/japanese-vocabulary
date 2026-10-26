package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.client.jev.JevClient
import com.japanese.vocabulary.translation.client.jev.dto.JevAnswer
import com.japanese.vocabulary.translation.client.jev.dto.JevChoiceQuestion
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupProvenance
import com.japanese.vocabulary.translation.model.AnalysisDefect
import com.japanese.vocabulary.translation.model.AnalysisDefectCause
import com.japanese.vocabulary.translation.model.PipelineSenseOption
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.PipelineTokenKey
import com.japanese.vocabulary.translation.model.SenseSelectionStageInput
import com.japanese.vocabulary.translation.service.pipeline.AnalysisDefectReporter
import com.japanese.vocabulary.translation.service.pipeline.JapaneseText
import com.japanese.vocabulary.translation.service.pipeline.SenseCandidateNarrowing
import org.springframework.stereotype.Component

/**
 * Picks, for every word with more than one dictionary sense, the one this line means. Runs on Jev:
 * one request per lyric line, one `choice` question per word.
 */
@Component
class SelectSensesStage(
    private val jevClient: JevClient,
    private val defectReporter: AnalysisDefectReporter,
) : PipelineStage<SenseSelectionStageInput, Map<PipelineTokenKey, Int>> {

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

        // A single candidate needs no model call.
        val settledSenseByKey = candidateTokensByIndex.values.flatten()
            .mapNotNull { token ->
                lexical.byTokenKey.getValue(token.key).options.singleOrNull()?.let { token.key to it.senseId }
            }.toMap()

        val selectableTokensByIndex = candidateTokensByIndex
            .mapValues { (_, tokens) -> tokens.filterNot { it.key in settledSenseByKey } }
            .filterValues { it.isNotEmpty() }

        // A repeated chorus line is asked once: separate requests gave the same word different senses
        // from one repeat to the next.
        val repeatsByLine = selectableTokensByIndex.entries.groupBy { (index, tokens) ->
            // Options too: a repeat whose word resolved to another entry (前 マエ vs ゼン) has different senseIds.
            input.source.rawByIndex[index].orEmpty() to tokens.map { token ->
                Triple(token.charStart, token.surface, lexical.byTokenKey.getValue(token.key).options.map { it.senseId })
            }
        }
        val selectedSenseByKey = repeatsByLine.values.flatMap { repeats ->
            val (index, tokens) = repeats.first()
            val chosen = selectLine(index, tokens, input).toMap()
            repeats.flatMap { (_, copies) ->
                copies.mapIndexed { i, copy -> copy.key to chosen.getValue(tokens[i].key) }
            }
        }.toMap()
        return settledSenseByKey + selectedSenseByKey
    }

    private suspend fun selectLine(
        index: Int,
        tokens: List<PipelineToken>,
        input: SenseSelectionStageInput,
    ): List<Pair<PipelineTokenKey, Int>> {
        val lexical = input.wordPreparation.lexical
        val line = input.source.rawByIndex[index].orEmpty()
        val offeredByKey = tokens.associate { token ->
            token.key to SenseCandidateNarrowing.narrow(token.contextGloss, lexical.byTokenKey.getValue(token.key).options)
        }
        val answers = jevClient.choose(
            call = CALL_NAME,
            state = mapOf(
                "japanese_line" to line,
                "korean_translation" to input.translationMap[index]?.koreanLyrics.orEmpty(),
            ),
            questions = tokens.associate { token ->
                token.key.tokenId to question(line, token, lexical.byTokenKey.getValue(token.key).baseForm, offeredByKey.getValue(token.key))
            },
            context = input.source.callContext,
        )
        return tokens.map { token ->
            token.key to senseFor(token, answers[token.key.tokenId], offeredByKey.getValue(token.key), index, input)
        }
    }

    /**
     * Wraps the asked word in 【】; without it, identical surfaces in one line (two て) got identical
     * questions and so the same answer.
     */
    private fun question(
        line: String,
        token: PipelineToken,
        headword: String,
        offered: List<PipelineSenseOption>,
    ): JevChoiceQuestion {
        val marked = if (token.charEnd <= line.length) {
            line.substring(0, token.charStart) + "【" + line.substring(token.charStart, token.charEnd) + "】" +
                line.substring(token.charEnd)
        } else {
            line
        }
        val gloss = token.contextGloss.takeIf { it.isNotBlank() }?.let { " Contextual gloss: $it." }.orEmpty()
        val criteria = offered.take(MAX_SENSE_OPTIONS).associate { it.senseId.toString() to label(it) } +
            (NO_SENSE.toString() to "None of the other options matches how this word is used in the line")
        return JevChoiceQuestion(
            // The tie-break: given a translation to lean on, the model still reached for figurative or rare senses
            // (開く as "to bloom", 前 as "front" in a time phrase).
            instructions = "Which dictionary sense matches how 「${token.surface}」 (headword $headword) " +
                "is used at the 【marked】 position in this Japanese lyric line: $marked$gloss " +
                "Pick the sense the line's korean_translation expresses. If several fit, pick the plainer, " +
                "more literal one listed first.",
            criteria = criteria,
        )
    }

    /**
     * Headword and reading lead the label only for [DictionaryLookupProvenance.AMBIGUOUS_HEADWORD], where
     * senses from several entries share a question (前[マエ] vs 前[ゼン]).
     */
    private fun label(option: PipelineSenseOption): String {
        val entry = if (option.provenance == DictionaryLookupProvenance.AMBIGUOUS_HEADWORD && option.headword != null) {
            "${option.headword}[${option.reading.orEmpty()}] "
        } else {
            ""
        }
        return "$entry${option.english} (${option.rawPos.joinToString(" / ")})"
    }

    private fun senseFor(
        token: PipelineToken,
        answer: JevAnswer?,
        offered: List<PipelineSenseOption>,
        index: Int,
        input: SenseSelectionStageInput,
    ): Int {
        val offeredIds = offered.map { it.senseId }
        if (answer == null) {
            report(token, index, input, AnalysisDefectCause.SENSE_MISSING, "tokenId=${token.key.tokenId}, offered=$offeredIds")
            return NO_SENSE
        }
        val chosen = answer.choice.toIntOrNull()
        // -1 is an offered option (チク in 「チクタクチク」 is a clock's tick), not a defect.
        if (chosen == NO_SENSE) return NO_SENSE
        if (chosen == null || chosen !in offeredIds) {
            report(
                token, index, input, AnalysisDefectCause.SENSE_REJECTED,
                "tokenId=${token.key.tokenId}, selectedSenseId=${answer.choice}, offered=$offeredIds",
            )
            return NO_SENSE
        }
        // Below the cut, a wrong meaning on the card is likelier than a right one, and no meaning
        // beats a wrong one.
        return if (answer.confidence < MIN_CONFIDENCE) NO_SENSE else chosen
    }

    private fun report(
        token: PipelineToken,
        index: Int,
        input: SenseSelectionStageInput,
        cause: AnalysisDefectCause,
        detail: String,
    ) {
        defectReporter.report(
            AnalysisDefect(
                workId = input.source.callContext.workId,
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

    companion object {
        /** The call name in `gemini_call_log`, kept from the Gemini era so old and new rows line up. */
        const val CALL_NAME = "select"

        /** The option id every question reserves for "no offered sense fits this line". */
        const val NO_SENSE = -1

        /**
         * Answers below this confidence are dropped as if Jev had said [NO_SENSE]. Hand-graded: below
         * 0.25 mostly wrong; between 0.25 and 0.5 right outnumbered wrong ~5:1, so a higher cut costs more than it saves.
         */
        const val MIN_CONFIDENCE = 0.25

        /** Jev takes at most 255 options per question, and one of them is [NO_SENSE]. */
        const val MAX_SENSE_OPTIONS = 254
    }
}
