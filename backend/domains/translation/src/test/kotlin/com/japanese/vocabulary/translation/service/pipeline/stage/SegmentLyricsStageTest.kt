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
import com.japanese.vocabulary.translation.model.AnalysisDefectCause
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
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * The reason this class exists: the headword check decides which tokens are worth a segmentation
 * retry, and a token the dictionary can never answer must not be one of them.
 */
class SegmentLyricsStageTest {
    private val geminiClient = mockk<GeminiClient>()
    private val jishoService = mockk<JishoService>()
    private val reported = mutableListOf<AnalysisDefect>()
    private val defectReporter = mockk<AnalysisDefectReporter> {
        every { reportAll(any()) } answers { reported += firstArg<Iterable<AnalysisDefect>>() }
    }
    private val stage = SegmentLyricsStage(
        geminiClient = geminiClient,
        segmentAnchoringValidator = SegmentAnchoringValidator(),
        gluedParticleSplitter = GluedParticleSplitter(jishoService),
        ruleMeaningProvider = RuleMeaningProvider(),
        lexicalResolver = LexicalResolver(jishoService),
        defectReporter = defectReporter,
    )

    @Test
    fun `an english ad-lib sung in hiragana is not a dictionary miss`(): Unit = runBlocking {
        // songId=118: あいうぉんちゅー is "I want you" transliterated, and the model kept the English as
        // the headword. Jisho cannot answer latin text, so the token is kept without a meaning — but
        // it went out as DICTIONARY_MISS because only a katakana *surface* was exempt from the check,
        // and this one is written in hiragana.
        val raw = "あいうぉんちゅーコール伝わんない"
        stubSegmentation(
            SegLineDto(
                index = 0,
                words = listOf(
                    SegWordDto("あいうぉんちゅー", "I want you", "アイウォンチュー", "アイウォンチュー", "I want you"),
                    SegWordDto("コール", "コール", "コール", "コール", "call"),
                    SegWordDto("伝わんない", "伝わる", "ツタワンナイ", "ツタワル", "to get through"),
                ),
            ),
        )
        stubJisho("伝わる" to found(entry(headword = "伝わる", reading = "ツタワル", english = "to be transmitted")))

        val result = stage.execute(source(raw))

        assertThat(reported).isEmpty()
        assertThat(result.tokensByIndex.getValue(0).map { it.surface })
            .containsExactly("あいうぉんちゅー", "コール", "伝わんない")
    }

    @Test
    fun `a hiragana headword the dictionary does not hold is still a dictionary miss`(): Unit = runBlocking {
        // The exemption is about the headword's script, not the surface's: までは is a particle glued
        // to another and no dictionary holds it, which is exactly the miss the retry exists to fix.
        val raw = "帰るまでは"
        stubSegmentation(
            SegLineDto(
                index = 0,
                words = listOf(
                    SegWordDto("帰る", "帰る", "カエル", "カエル", "to return"),
                    SegWordDto("までは", "までは", "マデハ", "マデハ", "until"),
                ),
            ),
        )
        stubJisho("帰る" to found(entry(headword = "帰る", reading = "カエル", english = "to return")))

        stage.execute(source(raw))

        assertThat(reported.map { it.cause to it.headword })
            .containsExactly(AnalysisDefectCause.DICTIONARY_MISS to "までは")
    }

    private fun stubSegmentation(vararg lines: SegLineDto) {
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns lines.toList()
    }

    private fun stubJisho(vararg entries: Pair<String, JishoEntryDto>) {
        val byWord = entries.toMap()
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { byWord[it] ?: JishoEntryDto(found = false, word = it) }
        }
    }

    private fun source(raw: String) = TranslationPipelineSource.from(
        listOf(LyricLineData(index = 0, startTimeMs = null, text = raw)),
        GeminiCallContext(songId = 118L, lyricId = 1L),
    )

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
            JishoOptionDto(pos = listOf("Verb"), english = english, englishDefinitions = listOf(english)),
        ),
    )
}
