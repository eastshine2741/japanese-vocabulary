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
import com.japanese.vocabulary.translation.model.AnalysisDefectCause
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
import io.mockk.slot
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class SelectSensesStageTest {
    private val geminiClient = mockk<GeminiClient>()
    private val reported = mutableListOf<AnalysisDefect>()
    private val defectReporter = mockk<AnalysisDefectReporter>().also {
        val defect = slot<AnalysisDefect>()
        every { it.report(capture(defect)) } answers { reported += defect.captured }
    }
    private val stage = SelectSensesStage(geminiClient, defectReporter)

    // 君のチクタクチクも僕の元に (song 94, line 39): jisho offered チク the 竹/築/地区 entries, and the
    // model answered -1 because a clock's tick is none of them — exactly what the prompt tells it to do.
    private val raw = "君のチクタクチクも僕の元に"
    private val token = PipelineToken(
        lineIndex = 39,
        surface = "チク",
        headword = "チク",
        charStart = 6,
        charEnd = 8,
        usedReading = "チク",
        baseFormReading = "チク",
        contextGloss = "tick (clock sound)",
    )
    private val offered = listOf(757, 758, 759, 760, 761, 762)

    @Test
    fun `takes an explicit -1 as the model saying no offered sense fits, not as a rejected choice`(): Unit = runBlocking {
        every { geminiClient.selectSenses(any(), any()) } returns listOf(
            SelectLineDto(index = 39, words = listOf(SelectWordDto(senseId = -1, tokenId = token.key.tokenId))),
        )

        val selected = stage.execute(input())

        assertThat(selected).containsEntry(token.key, -1)
        assertThat(reported).isEmpty()
    }

    @Test
    fun `still reports a sense the model was never offered`(): Unit = runBlocking {
        every { geminiClient.selectSenses(any(), any()) } returns listOf(
            SelectLineDto(index = 39, words = listOf(SelectWordDto(senseId = 999, tokenId = token.key.tokenId))),
        )

        val selected = stage.execute(input())

        assertThat(selected).containsEntry(token.key, -1)
        assertThat(reported.map { it.cause }).containsExactly(AnalysisDefectCause.SENSE_REJECTED)
        assertThat(reported.single().detail).contains("selectedSenseId=999")
    }

    @Test
    fun `still reports a -1 that names a token other than the one asked about`(): Unit = runBlocking {
        every { geminiClient.selectSenses(any(), any()) } returns listOf(
            SelectLineDto(index = 39, words = listOf(SelectWordDto(senseId = -1, tokenId = "39:0:1:君"))),
        )

        val selected = stage.execute(input())

        assertThat(selected).containsEntry(token.key, -1)
        assertThat(reported.map { it.cause }).containsExactly(AnalysisDefectCause.SENSE_REJECTED)
    }

    private fun input(): SenseSelectionStageInput {
        val options = offered.map { senseOption(it) }
        return SenseSelectionStageInput(
            source = TranslationPipelineSource.from(
                listOf(LyricLineData(index = 39, startTimeMs = null, text = raw)),
                GeminiCallContext(songId = 94L, lyricId = 1L),
            ),
            translationMap = mapOf(39 to TranslationResultDto(index = 39, koreanLyrics = "너의 째깍째깍도 내 곁에")),
            wordPreparation = WordPreparationResult(
                segLines = emptyList(),
                tokensByIndex = mapOf(39 to listOf(token)),
                ruleResolvedByKey = emptyMap(),
                lexical = LexicalResolution(
                    byTokenKey = mapOf(token.key to LexicalResolvedToken(token, "チク", options)),
                    optionsById = options.associateBy { it.senseId },
                ),
            ),
        )
    }

    private fun senseOption(senseId: Int) = PipelineSenseOption(
        senseId = senseId,
        baseForm = "竹",
        headword = "竹",
        reading = "チク",
        partOfSpeech = PartOfSpeech.NOUN,
        rawPos = listOf("Noun"),
        english = "bamboo",
        englishDefinitions = listOf("bamboo"),
        jlpt = emptyList(),
        provenance = JishoLookupProvenance.EXACT,
    )
}
