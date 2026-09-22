package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.SelectLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.model.AnalysisDefect
import com.japanese.vocabulary.translation.model.LexicalResolution
import com.japanese.vocabulary.translation.model.LexicalResolvedToken
import com.japanese.vocabulary.translation.model.PipelineSenseOption
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.SenseSelectionStageInput
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
import com.japanese.vocabulary.translation.model.WordPreparationResult
import com.japanese.vocabulary.translation.service.pipeline.AnalysisDefectReporter
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * The prompt tells the model to answer -1 when none of the offered senses fits, so -1 is an answer
 * the pipeline asked for. Only a senseId the token was never offered is a rejected choice.
 */
class SelectSensesStageTest {
    private val geminiClient = mockk<GeminiClient>()
    private val defectReporter = mockk<AnalysisDefectReporter>(relaxed = true)
    private val stage = SelectSensesStage(geminiClient, defectReporter)

    @Test
    fun `takes -1 as the answer it asked for and reports no defect`(): Unit = runBlocking {
        // 「カ カ カットイン」 — the カ here is the onomatopoeia of the following カットイン, and none of
        // the six senses jisho has for the counter/particle カ describes it.
        stubSelect(SelectWordDto(senseId = -1, tokenId = "44:0:1:カ"), SelectWordDto(senseId = -1, tokenId = "44:2:3:カ"))

        val selected = stage.execute(input())

        assertThat(selected).containsExactlyInAnyOrderEntriesOf(
            mapOf(key(charStart = 0) to -1, key(charStart = 2) to -1),
        )
        verify(exactly = 0) { defectReporter.report(any()) }
    }

    @Test
    fun `reports a senseId the token was never offered`(): Unit = runBlocking {
        stubSelect(SelectWordDto(senseId = 999, tokenId = "44:0:1:カ"), SelectWordDto(senseId = 543, tokenId = "44:2:3:カ"))

        val selected = stage.execute(input())

        assertThat(selected[key(charStart = 0)]).isEqualTo(-1)
        assertThat(selected[key(charStart = 2)]).isEqualTo(543)
        val defects = mutableListOf<AnalysisDefect>()
        verify(exactly = 1) { defectReporter.report(capture(defects)) }
        assertThat(defects.single().detail).contains("selectedSenseId=999")
    }

    private fun stubSelect(vararg words: SelectWordDto) {
        every { geminiClient.selectSenses(any(), any()) } returns listOf(SelectLineDto(index = LINE_INDEX, words = words.toList()))
    }

    private fun key(charStart: Int) = token(charStart).key

    private fun input(): SenseSelectionStageInput {
        val tokens = listOf(token(charStart = 0), token(charStart = 2))
        return SenseSelectionStageInput(
            source = TranslationPipelineSource.from(
                listOf(LyricLineData(index = LINE_INDEX, startTimeMs = null, text = LINE)),
                GeminiCallContext(songId = 162L, lyricId = 1L),
            ),
            translationMap = mapOf(LINE_INDEX to TranslationResultDto(index = LINE_INDEX, koreanLyrics = "카 카 컷인")),
            wordPreparation = WordPreparationResult(
                segLines = emptyList(),
                tokensByIndex = mapOf(LINE_INDEX to tokens),
                ruleResolvedByKey = emptyMap(),
                lexical = LexicalResolution(
                    byTokenKey = tokens.associate { it.key to LexicalResolvedToken(it, "カ", OPTIONS) },
                    optionsById = OPTIONS.associateBy { it.senseId },
                ),
            ),
        )
    }

    private fun token(charStart: Int) = PipelineToken(
        lineIndex = LINE_INDEX,
        surface = "カ",
        headword = "カ",
        charStart = charStart,
        charEnd = charStart + 1,
        usedReading = "カ",
        baseFormReading = "カ",
        contextGloss = "sound effect",
    )

    companion object {
        private const val LINE_INDEX = 44
        private const val LINE = "カ カ カットイン"

        /** What jisho offers for カ: counters, a question particle, mosquito — nothing onomatopoeic. */
        private val OPTIONS = (543..548).map { senseId ->
            PipelineSenseOption(
                senseId = senseId,
                baseForm = "カ",
                headword = "蚊",
                reading = "カ",
                partOfSpeech = PartOfSpeech.NOUN,
                rawPos = listOf("Noun"),
                english = "mosquito",
                englishDefinitions = listOf("mosquito"),
                jlpt = emptyList(),
                provenance = JishoLookupProvenance.EXACT,
            )
        }
    }
}
