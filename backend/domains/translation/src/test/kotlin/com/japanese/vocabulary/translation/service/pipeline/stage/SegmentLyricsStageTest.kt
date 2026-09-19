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

    @Test
    fun `a headword with no Japanese in it is not looked up or reported as a dictionary miss`(): Unit = runBlocking {
        // あいうぉんちゅー is "I want you" sung in hiragana, and the model gave the English back as the
        // headword. The surface is not katakana-only, so nothing exempted it, and jisho can never
        // answer a latin headword — the retry and the DICTIONARY_MISS report were both wasted.
        val line = "あいうぉんちゅーコール伝わんない"
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(
                index = 47,
                words = listOf(
                    word("あいうぉんちゅー", "I want you", "アイウォンチュー", "アイウォンチュー"),
                    word("コール", "コール", "コール", "コール"),
                    word("伝わんない", "伝わる", "ツタワンナイ", "ツタワル"),
                ),
            ),
        )
        coEvery { gluedParticleSplitter.split(any()) } answers { firstArg() }
        val lookedUp = mutableListOf<PipelineToken>()
        coEvery { lexicalResolver.unresolvedTokens(any()) } answers {
            val tokens = firstArg<List<PipelineToken>>()
            lookedUp += tokens
            tokens.filter { it.headword == "I want you" }.map { LexicalResolver.Unresolved(it, providerError = false) }
        }
        val reported = slot<Iterable<AnalysisDefect>>()
        every { defectReporter.reportAll(capture(reported)) } returns Unit

        val result = stage.execute(source(47 to line))

        assertThat(lookedUp.map { it.headword }).doesNotContain("I want you")
        assertThat(reported.captured).isEmpty()
        assertThat(result.tokensByIndex.getValue(47).map { it.surface })
            .containsExactly("あいうぉんちゅー", "コール", "伝わんない")
    }

    private fun source(vararg lines: Pair<Int, String>) = TranslationPipelineSource.from(
        lyricLines = lines.map { (index, text) -> LyricLineData(index = index, startTimeMs = null, text = text) },
        callContext = GeminiCallContext(songId = 118L, lyricId = 1L),
    )

    private fun word(surface: String, headword: String, used: String, base: String) = SegWordDto(
        surface = surface,
        headword = headword,
        usedReading = used,
        baseFormReading = base,
        contextGloss = "gloss",
    )
}
