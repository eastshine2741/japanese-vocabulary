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

/**
 * The headword check decides which lines are resent for a dictionary miss and which misses are
 * reported once the retry budget is spent. Only the two remote collaborators are stubbed — the
 * segmentation model and jisho — so what runs is the real anchoring, splitting, and resolving.
 */
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
    fun `an English phrase sung in kana is not a dictionary miss`(): Unit = runBlocking {
        // songId=118 line 47: the model kept the kana surface and gave the English original as its
        // headword. The surface is hiragana, so the katakana exemption does not apply, and jisho can
        // never answer an English headword — the line was retried and then reported as
        // DICTIONARY_MISS for a word no retry could have fixed.
        val raw = "あいうぉんちゅーコール伝わんない"
        stubJisho("伝わる" to found(entry(headword = "伝わる", reading = "ツタワル", english = "to be transmitted")))
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(
                index = 47,
                words = listOf(
                    word("あいうぉんちゅー", "I want you", "アイウォンチュー", "アイウォンチュー", "I want you"),
                    word("コール", "コール", "コール", "コール", "call"),
                    word("伝わんない", "伝わる", "ツタワンナイ", "ツタワル", "does not get through"),
                ),
            ),
        )

        val result = stage.execute(source(47, raw))

        assertThat(result.tokensByIndex.getValue(47).map { it.surface to it.headword })
            .containsExactly(
                "あいうぉんちゅー" to "I want you",
                "コール" to "コール",
                "伝わんない" to "伝わる",
            )
        val reported = slot<Iterable<AnalysisDefect>>()
        verify { defectReporter.reportAll(capture(reported)) }
        assertThat(reported.captured).isEmpty()
        // Nothing was worth a resend, so the model was asked once.
        verify(exactly = 1) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
    }

    private fun source(index: Int, raw: String) = TranslationPipelineSource.from(
        listOf(LyricLineData(index = index, startTimeMs = null, text = raw)),
        GeminiCallContext(songId = 118L, lyricId = 1L),
    )

    private fun word(surface: String, headword: String, usedReading: String, baseFormReading: String, gloss: String) =
        SegWordDto(
            surface = surface,
            headword = headword,
            usedReading = usedReading,
            baseFormReading = baseFormReading,
            contextGloss = gloss,
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
        senses = listOf(
            JishoOptionDto(pos = listOf("Godan verb"), english = english, englishDefinitions = listOf(english)),
        ),
    )
}
