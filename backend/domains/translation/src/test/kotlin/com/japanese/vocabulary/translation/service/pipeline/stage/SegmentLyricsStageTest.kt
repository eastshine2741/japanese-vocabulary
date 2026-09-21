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
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * The dictionary check decides which headwords are worth a retry and, when the budget is spent, which
 * are reported. Jisho is stubbed so the check's own exemptions are what is under test.
 */
class SegmentLyricsStageTest {
    private val geminiClient = mockk<GeminiClient>()
    private val gluedParticleSplitter = mockk<GluedParticleSplitter>()
    private val lexicalResolver = mockk<LexicalResolver>()
    private val defectReporter = mockk<AnalysisDefectReporter>(relaxed = true)
    private val stage = SegmentLyricsStage(
        geminiClient = geminiClient,
        segmentAnchoringValidator = SegmentAnchoringValidator(),
        gluedParticleSplitter = gluedParticleSplitter,
        ruleMeaningProvider = RuleMeaningProvider(),
        lexicalResolver = lexicalResolver,
        defectReporter = defectReporter,
    )

    init {
        coEvery { gluedParticleSplitter.split(any()) } answers { firstArg() }
    }

    /**
     * Song 118, line 47. The ad-lib is sung in English and written in hiragana, and the segmentation
     * model — correctly — has no Japanese dictionary form to give it. Its katakana twin `ステンバイミー`
     * is exempt from the headword check; this surface was not, so it burned the retry and shipped as
     * `DICTIONARY_MISS:I want you`.
     */
    @Test
    fun `a hiragana ad-lib with the prolonged sound mark is not a dictionary miss`(): Unit = runBlocking {
        val line = "あいうぉんちゅーコール伝わんない"
        val segmented = SegLineDto(
            index = 47,
            words = listOf(
                SegWordDto("あいうぉんちゅー", "I want you", "アイウォンチュー", "アイウォンチュー", "I want you"),
                SegWordDto("コール", "コール", "コール", "コール", "call"),
                SegWordDto("伝わんない", "伝わる", "ツタワンナイ", "ツタワル", "to get across"),
            ),
        )
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(segmented)
        // jisho holds コール and 伝わる, and nothing for an English phrase written in kana.
        coEvery { lexicalResolver.unresolvedTokens(any()) } answers {
            firstArg<List<PipelineToken>>()
                .filter { it.headword == "I want you" }
                .map { LexicalResolver.Unresolved(it, providerError = false) }
        }

        val result = stage.execute(source(47 to line))

        assertThat(result.tokensByIndex.getValue(47).map { it.surface })
            .containsExactly("あいうぉんちゅー", "コール", "伝わんない")
        val reported = slot<Iterable<AnalysisDefect>>()
        verify { defectReporter.reportAll(capture(reported)) }
        assertThat(reported.captured).isEmpty()
        // Nothing was worth a second attempt, so the line was segmented once.
        verify(exactly = 1) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
    }

    private fun source(vararg lines: Pair<Int, String>): TranslationPipelineSource =
        TranslationPipelineSource.from(
            lyricLines = lines.map { (index, text) -> LyricLineData(index = index, startTimeMs = null, text = text) },
            callContext = GeminiCallContext(songId = 118L, lyricId = null),
        )
}
