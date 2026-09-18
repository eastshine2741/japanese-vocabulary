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

    /**
     * songId=118 line 47: `あいうぉんちゅー` is "I want you" sung in hiragana, and the model gave the
     * English back as the headword. No Japanese dictionary holds it — the same truth as a
     * katakana-only coinage — but the katakana exemption looks at the surface, so this went to jisho,
     * spent the retry, and was reported as a DICTIONARY_MISS nobody can fix.
     */
    @Test
    fun `a headword with no Japanese in it is not a dictionary miss`(): Unit = runBlocking {
        val raw = "あいうぉんちゅーコール伝わんない"
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(
                47,
                listOf(
                    SegWordDto("あいうぉんちゅー", "I want you", "アイウォンチュー", "アイウォンチュー", "I want you"),
                    SegWordDto("コール", "コール", "コール", "コール", "call, shout"),
                    SegWordDto("伝わんない", "伝わる", "ツタワンナイ", "ツタワル", "get across"),
                ),
            ),
        )
        stub(
            "コール" to found(entry(headword = null, reading = "コール", english = "call")),
            "伝わる" to found(entry(headword = "伝わる", reading = "ツタワル", english = "to be transmitted")),
        )

        val result = stage.execute(source(47 to raw))

        val reported = slot<Iterable<AnalysisDefect>>()
        verify { defectReporter.reportAll(capture(reported)) }
        assertThat(reported.captured).isEmpty()
        // No defect means no retry: the line was accepted on the first attempt.
        verify(exactly = 1) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
        assertThat(result.tokensByIndex.getValue(47).map { it.surface })
            .containsExactly("あいうぉんちゅー", "コール", "伝わんない")
    }

    private fun source(vararg lines: Pair<Int, String>) = TranslationPipelineSource.from(
        lyricLines = lines.map { (index, text) -> LyricLineData(index = index, startTimeMs = null, text = text) },
        callContext = GeminiCallContext(songId = 118, lyricId = 118),
    )

    private fun stub(vararg entries: Pair<String, JishoEntryDto>) {
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
            JishoOptionDto(pos = listOf("Noun"), english = english, englishDefinitions = listOf(english)),
        ),
    )
}
