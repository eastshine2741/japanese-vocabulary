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
 * The headword check decides which tokens are worth a dictionary lookup, a retry, and a defect
 * report. These tests pin the exemptions: a token no Japanese dictionary can answer must not spend
 * the retry budget or be reported as a miss.
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

    @Test
    fun `a hiragana transliteration of an english phrase is exempt from the headword check`(): Unit = runBlocking {
        // Song 118 line 47: あいうぉんちゅー is "I want you" sung in hiragana. The model kept the English
        // phrase as the headword, which is right — but no Japanese dictionary holds it, so asking jisho,
        // retrying, and reporting DICTIONARY_MISS can only ever waste the budget.
        val raw = "あいうぉんちゅーコール伝わんない"
        val segmented = SegLineDto(
            index = 47,
            words = listOf(
                SegWordDto("あいうぉんちゅー", "I want you", "アイウォンチュー", "アイウォンチュー", "I want you"),
                SegWordDto("コール", "コール", "コール", "コール", "call"),
                SegWordDto("伝わんない", "伝わる", "ツタワンナイ", "ツタワル", "to get across"),
            ),
        )
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(segmented)
        coEvery { gluedParticleSplitter.split(any()) } answers { firstArg() }
        coEvery { lexicalResolver.unresolvedTokens(any()) } answers {
            firstArg<List<PipelineToken>>()
                .filter { it.headword == "I want you" }
                .map { LexicalResolver.Unresolved(it, providerError = false) }
        }

        val result = stage.execute(source(47 to raw))

        assertThat(result.tokensByIndex.getValue(47).map { it.surface })
            .containsExactly("あいうぉんちゅー", "コール", "伝わんない")
        val reported = slot<Iterable<AnalysisDefect>>()
        verify { defectReporter.reportAll(capture(reported)) }
        assertThat(reported.captured).isEmpty()
        // No defect means no resampled retry either: one segmentation call for the song.
        verify(exactly = 1) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
    }

    private fun source(vararg lines: Pair<Int, String>): TranslationPipelineSource = TranslationPipelineSource.from(
        lyricLines = lines.map { (index, text) -> LyricLineData(index = index, startTimeMs = null, text = text) },
        callContext = GeminiCallContext(songId = 118L, lyricId = 1L),
    )
}
