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
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * The reason this class exists: the dictionary headword check is what turns a missing entry into a
 * retry and, after that, into an `ANALYSIS_DEFECT` — so it has to know which misses are not the
 * model's fault, or every song with a transcribed English hook reports a word nobody can fix.
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
    fun `a hiragana transcription of English is not reported as a dictionary miss`(): Unit = runBlocking {
        // songId=118: あいうぉんちゅー is "I want you" sung in hiragana, and the model gave the English
        // back as the headword. Katakana loanwords are already exempt from the check; the same
        // loanword in hiragana was not, so jisho was asked for "I want you" and the line went out as
        // a DICTIONARY_MISS.
        val raw = "あいうぉんちゅーコール伝わんない"
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(
                index = 47,
                words = listOf(
                    SegWordDto("あいうぉんちゅー", "I want you", "アイウォンチュー", "アイウォンチュー", "I want you"),
                    SegWordDto("コール", "コール", "コール", "コール", "call"),
                    SegWordDto("伝わんない", "伝わる", "ツタワンナイ", "ツタワル", "does not get through"),
                ),
            ),
        )
        stubJisho("伝わる" to found(entry(headword = "伝わる", reading = "ツタワル", english = "to be transmitted")))
        val reported = slot<Iterable<AnalysisDefect>>()
        every { defectReporter.reportAll(capture(reported)) } returns Unit

        val result = stage.execute(source(47 to raw))

        assertThat(reported.captured).isEmpty()
        assertThat(result.tokensByIndex.getValue(47).map { it.surface })
            .containsExactly("あいうぉんちゅー", "コール", "伝わんない")
    }

    private fun source(vararg lines: Pair<Int, String>) = TranslationPipelineSource.from(
        lines.map { (index, text) -> LyricLineData(index = index, startTimeMs = null, text = text) },
        GeminiCallContext(songId = 118L, lyricId = 1L),
    )

    private fun stubJisho(vararg entries: Pair<String, JishoEntryDto>) {
        val byWord = entries.toMap()
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith {
                byWord[it] ?: JishoEntryDto(found = false, word = it, provenance = JishoLookupProvenance.NOT_FOUND)
            }
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
