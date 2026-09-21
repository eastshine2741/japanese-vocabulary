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
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import io.mockk.slot
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * The reason this class exists: the headword check decides which lines spend a retry and which
 * defects are reported, and a token no dictionary could ever answer must do neither.
 */
class SegmentLyricsStageTest {
    private val geminiClient = mockk<GeminiClient>()
    private val jishoService = mockk<JishoService>()
    private val defectReporter = mockk<AnalysisDefectReporter>()
    private val stage = SegmentLyricsStage(
        geminiClient = geminiClient,
        segmentAnchoringValidator = SegmentAnchoringValidator(),
        gluedParticleSplitter = GluedParticleSplitter(jishoService),
        ruleMeaningProvider = RuleMeaningProvider(),
        lexicalResolver = LexicalResolver(jishoService),
        defectReporter = defectReporter,
    )

    @Test
    fun `an english ad-lib written in hiragana is not a dictionary miss`(): Unit = runBlocking {
        // songId=118 line 47: the model kept the surface as sung and gave the English it transcribes
        // as the headword. Only katakana surfaces were exempt, so this went out as DICTIONARY_MISS
        // 'I want you' and spent a retry on a line no resample can change — jisho cannot answer a
        // latin headword any more than a katakana coinage.
        val raw = "あいうぉんちゅーコール伝わんない"
        stubJisho("伝わる" to found(headword = "伝わる", reading = "ツタワル", english = "to be transmitted"))
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
        val reported = slot<Iterable<AnalysisDefect>>()
        every { defectReporter.reportAll(capture(reported)) } just runs

        val result = stage.execute(source(47, raw))

        assertThat(reported.captured).isEmpty()
        verify(exactly = 1) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
        assertThat(result.tokensByIndex.getValue(47).map { it.surface })
            .containsExactly("あいうぉんちゅー", "コール", "伝わんない")
    }

    private fun source(index: Int, raw: String) = TranslationPipelineSource.from(
        listOf(LyricLineData(index = index, startTimeMs = null, text = raw)),
        GeminiCallContext(songId = 118L, lyricId = 118L),
    )

    private fun stubJisho(vararg entries: Pair<String, JishoEntryDto>) {
        val byWord = entries.toMap()
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { byWord[it] ?: JishoEntryDto(found = false, word = it) }
        }
    }

    private fun found(headword: String, reading: String, english: String) = JishoEntryDto(
        found = true,
        word = headword,
        entries = listOf(
            JishoDictionaryEntryDto(
                headword = headword,
                reading = reading,
                senses = listOf(
                    JishoOptionDto(pos = listOf("Godan verb"), english = english, englishDefinitions = listOf(english)),
                ),
            ),
        ),
        provenance = JishoLookupProvenance.EXACT,
    )
}
