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
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class SelectSensesStageTest {
    private val geminiClient = mockk<GeminiClient>()
    private val defectReporter = mockk<AnalysisDefectReporter>(relaxed = true)
    private val stage = SelectSensesStage(geminiClient, defectReporter)

    // 今日はいい天気ですね — three words go to sense-select: いい, 天気, です.
    private val raw = "今日はいい天気ですね"
    private val lineIndex = 1
    private val ii = token("いい", "いい")
    private val tenki = token("天気", "天気")
    private val desu = token("です", "です")
    private val iiOptions = options(10, 11)
    private val tenkiOptions = options(15, 16)
    private val desuOptions = options(22, 23, 24, 25, 26, 27, 28)

    @Test
    fun `reads each selection by its tokenId, not by its position in the response`(): Unit = runBlocking {
        // The model answered every word with a sense it was offered, but not in request order.
        every { geminiClient.selectSenses(any(), any()) } returns listOf(
            SelectLineDto(
                index = lineIndex,
                words = listOf(
                    SelectWordDto(senseId = 15, tokenId = tenki.key.tokenId),
                    SelectWordDto(senseId = 22, tokenId = desu.key.tokenId),
                    SelectWordDto(senseId = 10, tokenId = ii.key.tokenId),
                ),
            ),
        )

        val selected = stage.execute(input())

        assertThat(selected).containsExactlyInAnyOrderEntriesOf(
            mapOf(ii.key to 10, tenki.key to 15, desu.key to 22),
        )
        verify(exactly = 0) { defectReporter.report(any()) }
    }

    @Test
    fun `still rejects a sense the word was never offered`(): Unit = runBlocking {
        every { geminiClient.selectSenses(any(), any()) } returns listOf(
            SelectLineDto(
                index = lineIndex,
                words = listOf(
                    SelectWordDto(senseId = 10, tokenId = ii.key.tokenId),
                    SelectWordDto(senseId = 15, tokenId = tenki.key.tokenId),
                    SelectWordDto(senseId = 10, tokenId = desu.key.tokenId),
                ),
            ),
        )
        val reported = slot<AnalysisDefect>()
        every { defectReporter.report(capture(reported)) } returns Unit

        val selected = stage.execute(input())

        assertThat(selected[desu.key]).isEqualTo(-1)
        assertThat(reported.captured.cause).isEqualTo(AnalysisDefectCause.SENSE_REJECTED)
        assertThat(reported.captured.surface).isEqualTo("です")
    }

    private fun input() = SenseSelectionStageInput(
        source = TranslationPipelineSource.from(
            listOf(LyricLineData(index = lineIndex, startTimeMs = null, text = raw)),
            GeminiCallContext(songId = 130L, lyricId = 1L),
        ),
        translationMap = mapOf(lineIndex to TranslationResultDto(index = lineIndex, koreanLyrics = "오늘은 날씨가 좋네요")),
        wordPreparation = WordPreparationResult(
            segLines = emptyList(),
            tokensByIndex = mapOf(lineIndex to listOf(ii, tenki, desu)),
            ruleResolvedByKey = emptyMap(),
            lexical = LexicalResolution(
                byTokenKey = mapOf(
                    ii.key to LexicalResolvedToken(ii, "いい", iiOptions),
                    tenki.key to LexicalResolvedToken(tenki, "天気", tenkiOptions),
                    desu.key to LexicalResolvedToken(desu, "です", desuOptions),
                ),
                optionsById = (iiOptions + tenkiOptions + desuOptions).associateBy { it.senseId },
            ),
        ),
    )

    private fun token(surface: String, headword: String): PipelineToken {
        val start = raw.indexOf(surface)
        return PipelineToken(
            lineIndex = lineIndex,
            surface = surface,
            headword = headword,
            charStart = start,
            charEnd = start + surface.length,
            contextGloss = "gloss",
        )
    }

    private fun options(vararg senseIds: Int) = senseIds.map { senseId ->
        PipelineSenseOption(
            senseId = senseId,
            baseForm = "word",
            headword = "word",
            reading = "ワード",
            partOfSpeech = PartOfSpeech.NOUN,
            rawPos = listOf("Noun"),
            english = "sense $senseId",
            englishDefinitions = listOf("sense $senseId"),
            jlpt = emptyList(),
            provenance = JishoLookupProvenance.EXACT,
        )
    }
}
