package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.client.jev.JevClient
import com.japanese.vocabulary.translation.client.jev.dto.JevAnswer
import com.japanese.vocabulary.translation.client.jev.dto.JevChoiceQuestion
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
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
 * Picks, for every word that still has more than one dictionary sense, the one this line means.
 *
 * Runs on Jev, one request per lyric line with one `choice` question per word. Jev answers only with
 * an option it was offered plus a confidence, so the answer can never be an invented meaning.
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

        val selectedSenseByKey = selectableTokensByIndex.flatMap { (index, tokens) ->
            selectLine(index, tokens, input)
        }.toMap()
        return settledSenseByKey + selectedSenseByKey
    }

    private fun selectLine(
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
     * The line itself carries a 【】 around the word being asked about. Without it, two identical
     * surfaces in one line (the two て of 結婚して欲しい…なってみたい) got word-for-word identical
     * questions and so the same answer, whatever each one meant.
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
            instructions = "Which dictionary sense matches how 「${token.surface}」 (headword $headword) " +
                "is used at the 【marked】 position in this Japanese lyric line: $marked$gloss",
            criteria = criteria,
        )
    }

    /**
     * Headword and reading lead the label only for [JishoLookupProvenance.AMBIGUOUS_HEADWORD], the one
     * grade where senses from more than one dictionary entry share a question — there they are what
     * makes 前[マエ]'s "before / earlier" distinguishable from 前[ゼン]'s.
     */
    private fun label(option: PipelineSenseOption): String {
        val entry = if (option.provenance == JishoLookupProvenance.AMBIGUOUS_HEADWORD && option.headword != null) {
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
        // -1 is an offered option: チク in 「チクタクチク」 is a clock's tick, and none of 竹/築/地区 is,
        // so the model saying so is the designed answer, not a defect.
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
         * Answers below this confidence are dropped as if Jev had said [NO_SENSE].
         *
         * Hand-graded on five prod songs: of the 8 answers under 0.25, 6 were plainly wrong (the
         * quotative って read as "the said", 着せる as "pin a crime on") and one was right. Between
         * 0.25 and 0.5 right answers outnumbered wrong ones about five to one, so a higher cut
         * drops more right meanings than wrong ones.
         */
        const val MIN_CONFIDENCE = 0.25

        /** Jev takes at most 255 options per question, and one of them is [NO_SENSE]. */
        const val MAX_SENSE_OPTIONS = 254
    }
}
