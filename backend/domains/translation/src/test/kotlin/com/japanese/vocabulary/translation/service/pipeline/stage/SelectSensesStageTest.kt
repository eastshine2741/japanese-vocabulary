package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import com.japanese.vocabulary.translation.client.jev.JevClient
import com.japanese.vocabulary.translation.client.jev.dto.JevAnswer
import com.japanese.vocabulary.translation.client.jev.dto.JevChoiceQuestion
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
import org.assertj.core.api.Assertions.entry
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class SelectSensesStageTest {
    private val jevClient = mockk<JevClient>()
    private val defectReporter = mockk<AnalysisDefectReporter>(relaxed = true)
    private val stage = SelectSensesStage(jevClient, defectReporter)

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
    fun `asks one question per word, keyed by tokenId, with the word marked in the line`(): Unit = runBlocking {
        val questions = slot<Map<String, JevChoiceQuestion>>()
        val state = slot<Map<String, Any?>>()
        every { jevClient.choose(any(), capture(state), capture(questions), any()) } returns answers(10, 15, 22)

        stage.execute(input())

        assertThat(state.captured).containsEntry("japanese_line", raw).containsEntry("korean_translation", "오늘은 날씨가 좋네요")
        assertThat(questions.captured.keys).containsExactly(ii.key.tokenId, tenki.key.tokenId, desu.key.tokenId)
        val tenkiQuestion = questions.captured.getValue(tenki.key.tokenId)
        assertThat(tenkiQuestion.instructions).contains("今日はいい【天気】ですね").contains("Contextual gloss: gloss.")
        assertThat(tenkiQuestion.criteria).containsExactly(
            entry("15", "sense 15 (Noun)"),
            entry("16", "sense 16 (Noun)"),
            entry("-1", "None of the other options matches how this word is used in the line"),
        )
    }

    @Test
    fun `marks each of two identical surfaces in one line at its own position`(): Unit = runBlocking {
        // 結婚して欲しい…なってみたい: the two て are different words and must not get the same question.
        val line = "してなって"
        val first = PipelineToken(lineIndex, "て", "て", charStart = 1, charEnd = 2, contextGloss = "connective particle")
        val second = PipelineToken(lineIndex, "て", "て", charStart = 4, charEnd = 5, contextGloss = "connective particle")
        val options = options(30, 31)
        val questions = slot<Map<String, JevChoiceQuestion>>()
        every { jevClient.choose(any(), any(), capture(questions), any()) } answers {
            thirdArg<Map<String, JevChoiceQuestion>>().mapValues { JevAnswer("30", 0.9) }
        }

        stage.execute(input(line, listOf(first to options, second to options)))

        assertThat(questions.captured.getValue(first.key.tokenId).instructions).contains("し【て】なって")
        assertThat(questions.captured.getValue(second.key.tokenId).instructions).contains("してなっ【て】")
    }

    @Test
    fun `offers only the narrowed candidates and accepts an answer among them`(): Unit = runBlocking {
        // て glossed as a connective: 手's noun senses cannot be it, the particle senses can.
        val line = "殴って"
        val te = PipelineToken(lineIndex, "て", "て", charStart = 2, charEnd = 3, contextGloss = "connective")
        val hand = option(63, "hand / arm", "Noun")
        val please = option(84, "please (do)", "Particle")
        val and = option(77, "and", "Particle / Conjunction")
        val questions = slot<Map<String, JevChoiceQuestion>>()
        every { jevClient.choose(any(), any(), capture(questions), any()) } returns mapOf(te.key.tokenId to JevAnswer("84", 0.8))

        val selected = stage.execute(input(line, listOf(te to listOf(hand, please, and))))

        assertThat(questions.captured.getValue(te.key.tokenId).criteria.keys).containsExactly("84", "77", "-1")
        assertThat(selected).containsEntry(te.key, 84)
    }

    @Test
    fun `treats an answer below the confidence cut as no sense, without a defect`(): Unit = runBlocking {
        every { jevClient.choose(any(), any(), any(), any()) } returns mapOf(
            ii.key.tokenId to JevAnswer("10", SelectSensesStage.MIN_CONFIDENCE),
            tenki.key.tokenId to JevAnswer("15", SelectSensesStage.MIN_CONFIDENCE - 0.01),
            desu.key.tokenId to JevAnswer("22", 0.99),
        )

        val selected = stage.execute(input())

        assertThat(selected).containsExactlyInAnyOrderEntriesOf(
            mapOf(ii.key to 10, tenki.key to -1, desu.key to 22),
        )
        verify(exactly = 0) { defectReporter.report(any()) }
    }

    @Test
    fun `still rejects a sense the word was never offered`(): Unit = runBlocking {
        every { jevClient.choose(any(), any(), any(), any()) } returns answers(10, 15, 10)
        val reported = slot<AnalysisDefect>()
        every { defectReporter.report(capture(reported)) } returns Unit

        val selected = stage.execute(input())

        assertThat(selected[desu.key]).isEqualTo(-1)
        assertThat(reported.captured.cause).isEqualTo(AnalysisDefectCause.SENSE_REJECTED)
        assertThat(reported.captured.surface).isEqualTo("です")
    }

    @Test
    fun `reports a word the model left unanswered as missing`(): Unit = runBlocking {
        every { jevClient.choose(any(), any(), any(), any()) } returns mapOf(
            ii.key.tokenId to JevAnswer("10", 0.9),
            desu.key.tokenId to JevAnswer("22", 0.9),
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

    private fun answers(iiSense: Int, tenkiSense: Int, desuSense: Int) = mapOf(
        ii.key.tokenId to JevAnswer(iiSense.toString(), 0.9),
        tenki.key.tokenId to JevAnswer(tenkiSense.toString(), 0.9),
        desu.key.tokenId to JevAnswer(desuSense.toString(), 0.9),
    )

    private fun input(line: String, tokens: List<Pair<PipelineToken, List<PipelineSenseOption>>>) = SenseSelectionStageInput(
        source = TranslationPipelineSource.from(
            listOf(LyricLineData(index = lineIndex, startTimeMs = null, text = line)),
            GeminiCallContext(songId = 130L, lyricId = 1L),
        ),
        translationMap = mapOf(lineIndex to TranslationResultDto(index = lineIndex, koreanLyrics = "번역")),
        wordPreparation = WordPreparationResult(
            segLines = emptyList(),
            tokensByIndex = mapOf(lineIndex to tokens.map { it.first }),
            ruleResolvedByKey = emptyMap(),
            lexical = LexicalResolution(
                byTokenKey = tokens.associate { (token, options) -> token.key to LexicalResolvedToken(token, token.headword, options) },
                optionsById = tokens.flatMap { it.second }.associateBy { it.senseId },
            ),
        ),
    )

    private fun option(senseId: Int, english: String, pos: String) = PipelineSenseOption(
        senseId = senseId,
        baseForm = "て",
        headword = null,
        reading = "テ",
        partOfSpeech = PartOfSpeech.PARTICLE,
        rawPos = pos.split(" / "),
        english = english,
        englishDefinitions = listOf(english),
        jlpt = emptyList(),
        provenance = JishoLookupProvenance.EXACT,
    )

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
    inner class ExplicitNoMatch {
        private val reported = mutableListOf<AnalysisDefect>()
        private val defectReporter = mockk<AnalysisDefectReporter>().also {
            val defect = slot<AnalysisDefect>()
            every { it.report(capture(defect)) } answers { reported += defect.captured }
        }
        private val stage = SelectSensesStage(jevClient, defectReporter)

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
                every { jevClient.choose(any(), any(), any(), any()) } returns mapOf(
                    token.key.tokenId to JevAnswer("-1", 0.9),
                )

                val selected = stage.execute(input())

                assertThat(selected).containsEntry(token.key, -1)
                assertThat(reported).isEmpty()
            }

        @Test
        fun `still reports a -1 that names a token other than the one asked about`(): Unit = runBlocking {
            // The answer belongs to no token that was asked about, so チク itself went unanswered.
            every { jevClient.choose(any(), any(), any(), any()) } returns mapOf("39:0:1:君" to JevAnswer("-1", 0.9))

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
