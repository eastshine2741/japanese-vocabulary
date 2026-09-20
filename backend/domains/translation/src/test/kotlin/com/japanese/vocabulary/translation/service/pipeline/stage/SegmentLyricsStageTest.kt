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
 * The headword check decides which tokens are worth a segmentation retry. A jisho miss is evidence
 * of bad segmentation for a Japanese headword, but not for one the dictionary could never hold.
 */
class SegmentLyricsStageTest {
    private val geminiClient = mockk<GeminiClient>()
    private val lexicalResolver = mockk<LexicalResolver>()
    private val defectReporter = mockk<AnalysisDefectReporter>(relaxed = true)
    private val gluedParticleSplitter = mockk<GluedParticleSplitter> {
        coEvery { split(any()) } answers { firstArg() }
    }
    private val stage = SegmentLyricsStage(
        geminiClient = geminiClient,
        segmentAnchoringValidator = SegmentAnchoringValidator(),
        gluedParticleSplitter = gluedParticleSplitter,
        ruleMeaningProvider = RuleMeaningProvider(),
        lexicalResolver = lexicalResolver,
        defectReporter = defectReporter,
    )

    /**
     * Song 118, line 47: an English phrase sung in hiragana. The model wrote its headword as the
     * English it transliterates, which is not a word jisho can answer — the same truth the
     * katakana-only exemption already accepts for `ステンバイミー`. Asking anyway spent the retry on it and
     * reported a `DICTIONARY_MISS` nobody can fix.
     */
    @Test
    fun `a headword with no Japanese in it is not a dictionary miss`(): Unit = runBlocking {
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
        // Jisho that knows every Japanese headword and nothing else.
        coEvery { lexicalResolver.unresolvedTokens(any()) } answers {
            firstArg<List<PipelineToken>>()
                .filter { it.headword == "I want you" }
                .map { LexicalResolver.Unresolved(it, providerError = false) }
        }

        val result = stage.execute(source(47 to line))

        assertThat(result.tokensByIndex.getValue(47).map { it.headword })
            .containsExactly("I want you", "コール", "伝わる")
        assertThat(reportedDefects()).isEmpty()
        verify(exactly = 1) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
    }

    private fun source(vararg lines: Pair<Int, String>): TranslationPipelineSource =
        TranslationPipelineSource.from(
            lyricLines = lines.map { (index, text) -> LyricLineData(index = index, startTimeMs = null, text = text) },
            callContext = GeminiCallContext(songId = 118, lyricId = null),
        )

    private fun reportedDefects(): List<AnalysisDefect> {
        val defects = slot<Iterable<AnalysisDefect>>()
        verify { defectReporter.reportAll(capture(defects)) }
        return defects.captured.toList()
    }
}
