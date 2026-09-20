package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoDictionaryEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import com.japanese.vocabulary.translation.model.AnalysisDefect
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

class SegmentLyricsStageTest {
    private val geminiClient = mockk<GeminiClient>()
    private val jishoService = mockk<JishoService>()
    private val defectReporter = mockk<AnalysisDefectReporter>(relaxed = true)
    private val stage = SegmentLyricsStage(
        geminiClient = geminiClient,
        segmentAnchoringValidator = SegmentAnchoringValidator(),
        gluedParticleSplitter = GluedParticleSplitter(jishoService),
        ruleMeaningProvider = RuleMeaningProvider(),
        lexicalResolver = LexicalResolver(jishoService),
        defectReporter = defectReporter,
    )

    @Test
    fun `a headword with no Japanese in it is not a dictionary miss`(): Unit = runBlocking {
        // An English ad-lib sung in hiragana: the model cannot give it a Japanese dictionary form, so
        // it returns the English phrase as the headword. Jisho can never answer that, and unlike
        // ステンバイミー the surface is not katakana, so the katakana-only exemption did not cover it.
        val raw = "あいうぉんちゅーコール伝わんない"
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(
                index = 0,
                words = listOf(
                    word("あいうぉんちゅー", "I want you", "アイウォンチュー", "アイウォンチュー"),
                    word("コール", "コール", "コール", "コール"),
                    word("伝わんない", "伝わる", "ツタワンナイ", "ツタワル"),
                ),
            ),
        )
        stubJisho("伝わる" to found(entry(headword = "伝わる", reading = "ツタワル", english = "to be transmitted")))

        val result = stage.execute(
            TranslationPipelineSource.from(
                listOf(LyricLineData(index = 0, startTimeMs = null, text = raw)),
                GeminiCallContext(songId = 118L, lyricId = 1L),
            ),
        )

        val reported = slot<Iterable<AnalysisDefect>>()
        verify { defectReporter.reportAll(capture(reported)) }
        assertThat(reported.captured).isEmpty()
        assertThat(result.tokensByIndex.getValue(0).map { it.surface to it.headword })
            .containsExactly(
                "あいうぉんちゅー" to "I want you",
                "コール" to "コール",
                "伝わんない" to "伝わる",
            )
    }

    private fun word(surface: String, headword: String, usedReading: String, baseFormReading: String) =
        SegWordDto(
            surface = surface,
            headword = headword,
            usedReading = usedReading,
            baseFormReading = baseFormReading,
            contextGloss = "gloss",
        )

    private fun stubJisho(vararg entries: Pair<String, JishoEntryDto>) {
        val byWord = entries.toMap()
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { byWord[it] ?: JishoEntryDto(found = false, word = it) }
        }
    }

    private fun found(vararg entries: JishoDictionaryEntryDto) = JishoEntryDto(
        found = true,
        word = entries.first().headword ?: entries.first().reading.orEmpty(),
        entries = entries.toList(),
        provenance = JishoLookupProvenance.EXACT,
    )

    private fun entry(headword: String?, reading: String, english: String) = JishoDictionaryEntryDto(
        headword = headword,
        reading = reading,
        jlpt = emptyList(),
        senses = listOf(
            JishoOptionDto(pos = listOf("Godan verb"), english = english, englishDefinitions = listOf(english)),
        ),
    )
}
