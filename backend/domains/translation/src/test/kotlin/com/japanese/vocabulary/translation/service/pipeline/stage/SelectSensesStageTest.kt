package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.SelectLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.model.AnalysisDefect
import com.japanese.vocabulary.translation.model.AnalysisDefectCause
import com.japanese.vocabulary.translation.model.LexicalResolution
import com.japanese.vocabulary.translation.model.LexicalResolvedToken
import com.japanese.vocabulary.translation.model.PipelineSenseOption
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.SenseSelectionStageInput
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
import com.japanese.vocabulary.translation.model.WordPreparationResult
import com.japanese.vocabulary.translation.service.pipeline.AnalysisDefectReporter
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class SelectSensesStageTest {
    private val geminiClient = mockk<GeminiClient>()
    private val defectReporter = mockk<AnalysisDefectReporter>(relaxed = true)
    private val stage = SelectSensesStage(geminiClient, defectReporter)

    // 今日はいい天気ですね — three words go to sense-select: いい, 天気, です.
    private val raw = "今日はいい天気ですね"
    private val lineIndex = 1
    private val ii = token("いい", "いい")
    private val tenki = token("天気", "天気")
    private val desu = token("です", "です")
    private val iiOptions = options(10, 11)
    private val tenkiOptions = options(15, 16)
    private val desuOptions = options(22, 23, 24, 25, 26, 27, 28)

    @Test
    fun `reads each selection by its tokenId, not by its position in the response`(): Unit = runBlocking {
        // The model answered every word with a sense it was offered, but not in request order.
        every { geminiClient.selectSenses(any(), any()) } returns listOf(
            SelectLineDto(
                index = lineIndex,
                words = listOf(
                    SelectWordDto(senseId = 15, tokenId = tenki.key.tokenId),
                    SelectWordDto(senseId = 22, tokenId = desu.key.tokenId),
                    SelectWordDto(senseId = 10, tokenId = ii.key.tokenId),
                ),
            ),
        )

        val selected = stage.execute(input())

        assertThat(selected).containsExactlyInAnyOrderEntriesOf(
            mapOf(ii.key to 10, tenki.key to 15, desu.key to 22),
        )
        verify(exactly = 0) { defectReporter.report(any()) }
    }

    @Test
    fun `still rejects a sense the word was never offered`(): Unit = runBlocking {
        every { geminiClient.selectSenses(any(), any()) } returns listOf(
            SelectLineDto(
                index = lineIndex,
                words = listOf(
                    SelectWordDto(senseId = 10, tokenId = ii.key.tokenId),
                    SelectWordDto(senseId = 15, tokenId = tenki.key.tokenId),
                    SelectWordDto(senseId = 10, tokenId = desu.key.tokenId),
                ),
            ),
        )
        val reported = slot<AnalysisDefect>()
        every { defectReporter.report(capture(reported)) } returns Unit

        val selected = stage.execute(input())

        assertThat(selected[desu.key]).isEqualTo(-1)
        assertThat(reported.captured.cause).isEqualTo(AnalysisDefectCause.SENSE_REJECTED)
        assertThat(reported.captured.surface).isEqualTo("です")
    }

    @Test
    fun `reports a word the model left unanswered as missing, not as the next word rejected`(): Unit = runBlocking {
        // No answer for 天気. By position, です's answer would have landed on 天気 and です on nothing.
        every { geminiClient.selectSenses(any(), any()) } returns listOf(
            SelectLineDto(
                index = lineIndex,
                words = listOf(
                    SelectWordDto(senseId = 10, tokenId = ii.key.tokenId),
                    SelectWordDto(senseId = 22, tokenId = desu.key.tokenId),
                ),
            ),
        )
        val reported = mutableListOf<AnalysisDefect>()
        every { defectReporter.report(capture(reported)) } returns Unit

        val selected = stage.execute(input())

        assertThat(selected).containsExactlyInAnyOrderEntriesOf(
            mapOf(ii.key to 10, tenki.key to -1, desu.key to 22),
        )
        assertThat(reported).singleElement().satisfies({
            assertThat(it.cause).isEqualTo(AnalysisDefectCause.SENSE_MISSING)
            assertThat(it.surface).isEqualTo("天気")
            assertThat(it.detail).isEqualTo("tokenId=${tenki.key.tokenId}, offered=[15, 16]")
        })
    }

    @Test
    fun `reports a missing answer for the last word of the line`(): Unit = runBlocking {
        every { geminiClient.selectSenses(any(), any()) } returns listOf(
            SelectLineDto(
                index = lineIndex,
                words = listOf(
                    SelectWordDto(senseId = 10, tokenId = ii.key.tokenId),
                    SelectWordDto(senseId = 15, tokenId = tenki.key.tokenId),
                ),
            ),
        )
        val reported = mutableListOf<AnalysisDefect>()
        every { defectReporter.report(capture(reported)) } returns Unit

        val selected = stage.execute(input())

        assertThat(selected).containsExactlyInAnyOrderEntriesOf(
            mapOf(ii.key to 10, tenki.key to 15, desu.key to -1),
        )
        assertThat(reported.map { it.cause to it.surface })
            .containsExactly(AnalysisDefectCause.SENSE_MISSING to "です")
    }

    private fun input() =SenseSelectionStageInput(
        source = TranslationPipelineSource.from(
            listOf(LyricLineData(index = lineIndex, startTimeMs = null, text = raw)),
            GeminiCallContext(songId = 130L, lyricId = 1L),
        ),
        translationMap = mapOf(lineIndex to TranslationResultDto(index = lineIndex, koreanLyrics = "오늘은 날씨가 좋네요")),
        wordPreparation = WordPreparationResult(
            segLines = emptyList(),
            tokensByIndex = mapOf(lineIndex to listOf(ii, tenki, desu)),
            ruleResolvedByKey = emptyMap(),
            lexical = LexicalResolution(
                byTokenKey = mapOf(
                    ii.key to LexicalResolvedToken(ii, "いい", iiOptions),
                    tenki.key to LexicalResolvedToken(tenki, "天気", tenkiOptions),
                    desu.key to LexicalResolvedToken(desu, "です", desuOptions),
                ),
                optionsById = (iiOptions + tenkiOptions + desuOptions).associateBy { it.senseId },
            ),
        ),
    )

    private fun token(surface: String, headword: String): PipelineToken {
        val start = raw.indexOf(surface)
        return PipelineToken(
            lineIndex = lineIndex,
            surface = surface,
            headword = headword,
            charStart = start,
            charEnd = start + surface.length,
            contextGloss = "gloss",
        )
    }

    private fun options(vararg senseIds: Int) = senseIds.map { senseId ->
        PipelineSenseOption(
            senseId = senseId,
            baseForm = "word",
            headword = "word",
            reading = "ワード",
            partOfSpeech = PartOfSpeech.NOUN,
            rawPos = listOf("Noun"),
            english = "sense $senseId",
            englishDefinitions = listOf("sense $senseId"),
            jlpt = emptyList(),
            provenance = JishoLookupProvenance.EXACT,
        )
    }

    @Nested
    inner class RetryMissingTokens {
        private val reported = mutableListOf<AnalysisDefect>()
        private val defectReporter = mockk<AnalysisDefectReporter>().also {
            val defect = slot<AnalysisDefect>()
            every { it.report(capture(defect)) } answers { reported += defect.captured }
        }
        private val stage = SelectSensesStage(geminiClient, defectReporter)

        // Song 223, line 8: one sense-select answer dropped every word but the first 歌え.
        private val raw = "歌え！（歌え！）最高のテンション 波の音に乗せて ドンブラコ"
        private val line = 8
        private val utae1 = lineToken("歌え", "歌う", 0)
        private val utae2 = lineToken("歌え", "歌う", 4)
        private val saikou = lineToken("最高", "最高", 8)
        private val nami = lineToken("波", "波", 17)
        private val oto = lineToken("音", "音", 19)
        private val offeredByToken = mapOf(
            utae1 to listOf(117, 118),
            utae2 to listOf(117, 118),
            saikou to listOf(119, 120),
            nami to listOf(124, 125, 126, 127),
            oto to listOf(128, 129, 130),
        )

        @Test
        fun `asks again for the tokens the first answer left out`(): Unit = runBlocking {
            every { geminiClient.selectSenses(any(), any()) } returnsMany listOf(
                listOf(SelectLineDto(index = line, words = listOf(SelectWordDto(117, utae1.key.tokenId)))),
                listOf(
                    SelectLineDto(
                        index = line,
                        words = listOf(
                            SelectWordDto(117, utae2.key.tokenId),
                            SelectWordDto(119, saikou.key.tokenId),
                            SelectWordDto(124, nami.key.tokenId),
                            SelectWordDto(128, oto.key.tokenId),
                        ),
                    ),
                ),
            )

            val selected = stage.execute(input())

            assertThat(selected).containsExactlyInAnyOrderEntriesOf(
                mapOf(utae1.key to 117, utae2.key to 117, saikou.key to 119, nami.key to 124, oto.key to 128),
            )
            assertThat(reported).isEmpty()
        }

        private fun lineToken(surface: String, headword: String, start: Int) = PipelineToken(
            lineIndex = line,
            surface = surface,
            headword = headword,
            charStart = start,
            charEnd = start + surface.length,
            contextGloss = "gloss",
        )

        private fun input(): SenseSelectionStageInput {
            val optionsByToken = offeredByToken.mapValues { (_, ids) -> options(*ids.toIntArray()) }
            return SenseSelectionStageInput(
                source = TranslationPipelineSource.from(
                    listOf(LyricLineData(index = line, startTimeMs = null, text = raw)),
                    GeminiCallContext(songId = 223L, lyricId = 1L),
                ),
                translationMap = mapOf(line to TranslationResultDto(index = line, koreanLyrics = "노래해! 최고의 텐션")),
                wordPreparation = WordPreparationResult(
                    segLines = emptyList(),
                    tokensByIndex = mapOf(line to offeredByToken.keys.toList()),
                    ruleResolvedByKey = emptyMap(),
                    lexical = LexicalResolution(
                        byTokenKey = optionsByToken.entries.associate { (token, options) ->
                            token.key to LexicalResolvedToken(token, token.headword, options)
                        },
                        optionsById = optionsByToken.values.flatten().associateBy { it.senseId },
                    ),
                ),
            )
        }
    }

    @Nested
    inner class ExplicitNoMatch {
        private val reported = mutableListOf<AnalysisDefect>()
        private val defectReporter = mockk<AnalysisDefectReporter>().also {
            val defect = slot<AnalysisDefect>()
            every { it.report(capture(defect)) } answers { reported += defect.captured }
        }
        private val stage = SelectSensesStage(geminiClient, defectReporter)

        // 君のチクタクチクも僕の元に (song 94, line 39): jisho offered チク the 竹/築/地区 entries, and the
        // model answered -1 because a clock's tick is none of them — exactly what the prompt tells it to do.
        private val raw = "君のチクタクチクも僕の元に"
        private val token = PipelineToken(
            lineIndex = 39,
            surface = "チク",
            headword = "チク",
            charStart = 6,
            charEnd = 8,
            usedReading = "チク",
            baseFormReading = "チク",
            contextGloss = "tick (clock sound)",
        )
        private val offered = listOf(757, 758, 759, 760, 761, 762)

        @Test
        fun `takes an explicit -1 as the model saying no offered sense fits, not as a rejected choice`(): Unit =
            runBlocking {
                every { geminiClient.selectSenses(any(), any()) } returns listOf(
                    SelectLineDto(index = 39, words = listOf(SelectWordDto(senseId = -1, tokenId = token.key.tokenId))),
                )

                val selected = stage.execute(input())

                assertThat(selected).containsEntry(token.key, -1)
                assertThat(reported).isEmpty()
            }

        @Test
        fun `still reports a -1 that names a token other than the one asked about`(): Unit = runBlocking {
            // The answer belongs to no token that was asked about, so チク itself went unanswered.
            every { geminiClient.selectSenses(any(), any()) } returns listOf(
                SelectLineDto(index = 39, words = listOf(SelectWordDto(senseId = -1, tokenId = "39:0:1:君"))),
            )

            val selected = stage.execute(input())

            assertThat(selected).containsEntry(token.key, -1)
            assertThat(reported.map { it.cause }).containsExactly(AnalysisDefectCause.SENSE_MISSING)
        }

        private fun input(): SenseSelectionStageInput {
            val options = offered.map { senseOption(it) }
            return SenseSelectionStageInput(
                source = TranslationPipelineSource.from(
                    listOf(LyricLineData(index = 39, startTimeMs = null, text = raw)),
                    GeminiCallContext(songId = 94L, lyricId = 1L),
                ),
                translationMap = mapOf(39 to TranslationResultDto(index = 39, koreanLyrics = "너의 째깍째깍도 내 곁에")),
                wordPreparation = WordPreparationResult(
                    segLines = emptyList(),
                    tokensByIndex = mapOf(39 to listOf(token)),
                    ruleResolvedByKey = emptyMap(),
                    lexical = LexicalResolution(
                        byTokenKey = mapOf(token.key to LexicalResolvedToken(token, "チク", options)),
                        optionsById = options.associateBy { it.senseId },
                    ),
                ),
            )
        }

        private fun senseOption(senseId: Int) = PipelineSenseOption(
            senseId = senseId,
            baseForm = "竹",
            headword = "竹",
            reading = "チク",
            partOfSpeech = PartOfSpeech.NOUN,
            rawPos = listOf("Noun"),
            english = "bamboo",
            englishDefinitions = listOf("bamboo"),
            jlpt = emptyList(),
            provenance = JishoLookupProvenance.EXACT,
        )
    }
}
