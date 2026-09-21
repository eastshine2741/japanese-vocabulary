package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import com.japanese.vocabulary.translation.model.AnalysisDefect
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
import com.japanese.vocabulary.translation.service.pipeline.AnalysisDefectReporter
import com.japanese.vocabulary.translation.service.pipeline.GluedParticleSplitter
import com.japanese.vocabulary.translation.service.pipeline.LexicalResolver
import com.japanese.vocabulary.translation.service.pipeline.RuleMeaningProvider
import com.japanese.vocabulary.translation.service.pipeline.SegmentAnchoringValidator
import io.mockk.coEvery
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import io.mockk.slot
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class SegmentLyricsStageTest {
    private val geminiClient = mockk<GeminiClient>()
    private val gluedParticleSplitter = mockk<GluedParticleSplitter>()
    private val lexicalResolver = mockk<LexicalResolver>()
    private val defectReporter = mockk<AnalysisDefectReporter>()
    private val stage = SegmentLyricsStage(
        geminiClient = geminiClient,
        segmentAnchoringValidator = SegmentAnchoringValidator(),
        gluedParticleSplitter = gluedParticleSplitter,
        ruleMeaningProvider = RuleMeaningProvider(),
        lexicalResolver = lexicalResolver,
        defectReporter = defectReporter,
    )

    /** Every headword jisho holds, as far as this test is concerned. Everything else is a miss. */
    private val dictionary = setOf("伝わる")

    @Test
    fun `does not ask the dictionary about a headword written in no Japanese script`(): Unit = runBlocking {
        // あいうぉんちゅー is "I want you" sung in hiragana, and the model handed the English back as the
        // headword. jisho cannot answer that whichever way it is asked, so it is not a miss to retry or
        // report — the same truth as a katakana-only coinage, seen on the headword instead of the surface.
        val raw = "あいうぉんちゅーコール伝わんない"
        stubSegmentation(
            SegLineDto(
                0,
                listOf(
                    word("あいうぉんちゅー", "I want you", "アイウォンチュー", "アイウォンチュー"),
                    word("コール", "コール", "コール", "コール"),
                    word("伝わんない", "伝わる", "ツタワンナイ", "ツタワル"),
                ),
            ),
        )
        val reported = slot<Iterable<AnalysisDefect>>()
        every { defectReporter.reportAll(capture(reported)) } just runs

        val result = stage.execute(source(raw))

        assertThat(result.tokensByIndex[0]!!.map { it.headword }).containsExactly("I want you", "コール", "伝わる")
        assertThat(reported.captured.map { it.headword }).doesNotContain("I want you")
        verify(exactly = 1) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
    }

    private fun stubSegmentation(vararg lines: SegLineDto) {
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns lines.toList()
        coEvery { gluedParticleSplitter.split(any()) } answers { firstArg() }
        coEvery { lexicalResolver.unresolvedTokens(any()) } answers {
            firstArg<List<PipelineToken>>()
                .filter { it.headword !in dictionary }
                .map { LexicalResolver.Unresolved(it, providerError = false) }
        }
    }

    private fun source(vararg lines: String) = TranslationPipelineSource.from(
        lines.mapIndexed { index, text -> LyricLineData(index = index, startTimeMs = null, text = text) },
        GeminiCallContext(songId = 118L, lyricId = 1L),
    )

    private fun word(surface: String, headword: String, usedReading: String, baseFormReading: String) =
        SegWordDto(
            surface = surface,
            headword = headword,
            usedReading = usedReading,
            baseFormReading = baseFormReading,
            contextGloss = "gloss",
        )
}
