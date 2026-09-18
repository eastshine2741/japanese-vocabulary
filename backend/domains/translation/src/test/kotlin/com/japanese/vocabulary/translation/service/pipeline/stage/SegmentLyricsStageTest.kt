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
 * The headword check decides which lines get a resampled retry and which words are reported as
 * defects. What it must not do is spend either on a word no Japanese dictionary can ever answer.
 */
class SegmentLyricsStageTest {
    private val geminiClient = mockk<GeminiClient>()
    private val gluedParticleSplitter = mockk<GluedParticleSplitter>()
    private val lexicalResolver = mockk<LexicalResolver>()
    private val defectReporter = mockk<AnalysisDefectReporter>()
    private val reported = slot<Iterable<AnalysisDefect>>()
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
        every { defectReporter.reportAll(capture(reported)) } returns Unit
    }

    /**
     * Song 118, line 47: `あいうぉんちゅー` is "I want you" sung in hiragana, and the model said so. The
     * surface is not katakana, so the loanword exemption did not apply and jisho was asked for an
     * English phrase — a miss no retry can fix, reported as a `DICTIONARY_MISS` for the song.
     */
    @Test
    fun `does not retry or report a headword that has no Japanese in it`(): Unit = runBlocking {
        val line = "あいうぉんちゅーコール伝わんない"
        stubSegmentation(
            SegLineDto(
                index = 47,
                words = listOf(
                    SegWordDto("あいうぉんちゅー", "I want you", "アイウォンチュー", "アイウォンチュー", "I want you"),
                    SegWordDto("コール", "コール", "コール", "コール", "call"),
                    SegWordDto("伝わんない", "伝わる", "ツタワンナイ", "ツタワル", "to get across"),
                ),
            ),
        )
        // jisho knows every real word on the line; only the English phrase has no entry.
        coEvery { lexicalResolver.unresolvedTokens(any()) } answers {
            firstArg<List<PipelineToken>>()
                .filter { it.headword == "I want you" }
                .map { LexicalResolver.Unresolved(it, providerError = false) }
        }

        val result = stage.execute(source(47 to line))

        assertThat(result.tokensByIndex.getValue(47).map { it.surface })
            .containsExactly("あいうぉんちゅー", "コール", "伝わんない")
        assertThat(reported.captured).isEmpty()
        verify(exactly = 1) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
    }

    private fun stubSegmentation(vararg lines: SegLineDto) {
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } answers {
            val requested = firstArg<List<Map<String, Any?>>>().map { it["index"] }.toSet()
            lines.filter { it.index in requested }
        }
    }

    private fun source(vararg lines: Pair<Int, String>): TranslationPipelineSource = TranslationPipelineSource.from(
        lyricLines = lines.map { (index, text) -> LyricLineData(index = index, startTimeMs = null, text = text) },
        callContext = GeminiCallContext(songId = 118L, lyricId = 1L),
    )
}
