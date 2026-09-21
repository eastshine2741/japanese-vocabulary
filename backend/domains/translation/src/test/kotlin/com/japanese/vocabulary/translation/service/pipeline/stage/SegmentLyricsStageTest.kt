package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import com.japanese.vocabulary.translation.model.AnalysisDefect
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
import com.japanese.vocabulary.translation.service.JishoService
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
 * The headword check decides which tokens are worth a dictionary retry. A word the dictionary was
 * never going to hold must not count as a miss: the retry cannot fix it, and the defect it reports
 * is not a word for anyone to fix.
 */
class SegmentLyricsStageTest {
    private val geminiClient = mockk<GeminiClient>()
    private val lexicalResolver = mockk<LexicalResolver>()
    private val defectReporter = mockk<AnalysisDefectReporter>(relaxed = true)
    private val stage = SegmentLyricsStage(
        geminiClient = geminiClient,
        segmentAnchoringValidator = SegmentAnchoringValidator(),
        gluedParticleSplitter = GluedParticleSplitter(mockk<JishoService>()),
        ruleMeaningProvider = RuleMeaningProvider(),
        lexicalResolver = lexicalResolver,
        defectReporter = defectReporter,
    )

    @Test
    fun `a hiragana ad-lib whose headword is not Japanese is exempt from the headword check`(): Unit = runBlocking {
        // Song 118, line 47. `あいうぉんちゅー` is "I want you" sung in hiragana — the same kind of coinage
        // as a katakana `ステンバイミー`, but written in the script the exemption did not cover, so
        // jisho was asked for `I want you` and the miss was reported as a DICTIONARY_MISS.
        val line = "あいうぉんちゅーコール伝わんない"
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(
                index = 47,
                words = listOf(
                    SegWordDto("あいうぉんちゅー", "I want you", "アイウォンチュー", "アイウォンチュー", "I want you"),
                    SegWordDto("コール", "コール", "コール", "コール", "call"),
                    SegWordDto("伝わんない", "伝わる", "ツタワンナイ", "ツタワル", "to get across"),
                ),
            ),
        )
        // jisho holds 伝わる and nothing spelled `I want you`.
        coEvery { lexicalResolver.unresolvedTokens(any()) } answers {
            firstArg<List<PipelineToken>>()
                .filter { it.headword == "I want you" }
                .map { LexicalResolver.Unresolved(it, providerError = false) }
        }
        val reported = slot<Iterable<AnalysisDefect>>()
        every { defectReporter.reportAll(capture(reported)) } returns Unit

        val result = stage.execute(source(47 to line))

        assertThat(result.tokensByIndex.getValue(47).map { it.surface to it.headword })
            .containsExactly("あいうぉんちゅー" to "I want you", "コール" to "コール", "伝わんない" to "伝わる")
        assertThat(reported.captured).isEmpty()
        // No defect means no resampled retry either: the line was segmented once.
        verify(exactly = 1) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
    }

    private fun source(vararg lines: Pair<Int, String>): TranslationPipelineSource = TranslationPipelineSource.from(
        lyricLines = lines.map { (index, text) -> LyricLineData(index = index, startTimeMs = null, text = text) },
        callContext = GeminiCallContext(songId = 118, lyricId = null),
    )
}
