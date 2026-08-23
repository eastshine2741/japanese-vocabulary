package com.japanese.vocabulary.translation.service

import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.SenseTranslationDto
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.client.jisho.dto.JishoDictionaryEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import com.japanese.vocabulary.translation.service.pipeline.JapaneseText
import com.japanese.vocabulary.translation.service.pipeline.stage.SegmentLyricsStage
import com.japanese.vocabulary.translation.service.pipeline.stage.SelectSensesStage
import com.japanese.vocabulary.song.batch.SongAnalysisWorkCompletionService
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.time.Duration
import java.time.Instant

class KoreanLyricTranslationServiceTest : BatchBaseIntegrationTest() {

    @Autowired private lateinit var translationService: KoreanLyricTranslationService
    @Autowired private lateinit var workService: SongAnalysisWorkService
    @Autowired private lateinit var completionService: SongAnalysisWorkCompletionService
    @Autowired private lateinit var workRepository: SongAnalysisWorkRepository
    @Autowired private lateinit var lyricRepository: LyricRepository
    @Autowired private lateinit var songRepository: SongRepository

    private fun seedLyric(
        lines: List<String>,
    ): LyricEntity {
        val song = songRepository.save(
            SongEntity(
                title = "テスト${System.nanoTime()}",
                artist = "アーティスト",
                durationSeconds = 200,
            ),
        )
        return lyricRepository.save(
            LyricEntity(
                songId = song.id!!,
                lyricType = LyricType.PLAIN,
                rawContent = lines.mapIndexed { i, t -> LyricLineData(index = i, startTimeMs = null, text = t) },
            ),
        )
    }

    private fun seedWork(title: String, status: SongAnalysisWorkStatus = SongAnalysisWorkStatus.PENDING): SongAnalysisWorkEntity {
        val artist = "アーティスト"
        return workRepository.save(
            SongAnalysisWorkEntity(
                rawTitle = title,
                rawArtist = artist,
                activeDedupKey = if (status == SongAnalysisWorkStatus.PENDING) {
                    SongAnalysisWorkService.buildActiveDedupKey(title, artist)
                } else {
                    null
                },
                status = status,
                triggerSource = SongAnalysisTriggerSource.USER_APP,
            ),
        )
    }

    private companion object {
        /** Katakana reading shared by [segWord] and [exactEntry] so the pair match lands on EXACT. */
        const val DEFAULT_READING = "ヨミ"

        /**
         * A second sense on every [exactEntry], so there is something to choose between and the
         * pipeline actually calls sense-select. A lone candidate is settled in code without a request,
         * which is correct but would leave the select path untested.
         */
        val DISTRACTOR_SENSE = JishoOptionDto(
            pos = listOf("Noun"),
            english = "unrelated distractor",
            englishDefinitions = listOf("unrelated distractor"),
        )
    }

    private suspend fun processLyric(lyric: LyricEntity): Boolean {
        val lines = translationService.runPipeline(lyric)
        translationService.saveAnalyzedContent(lyric, lines)
        return true
    }

    /**
     * Stub the redesigned pipeline so it round-trips deterministically:
     * - segment: one word per line whose surface/headword = the whole line text, reading ヨミ.
     * - jisho: every headword → one entry [ヨミ] with two senses, so the pair matches and there is
     *   something for sense-select to choose between.
     * - sense-select: pick the first sense's senseId per segment (or -1 when none).
     * - translate-sense: koreanText = "뜻:{senseId}".
     */
    private fun stubHappyPath() {
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } answers {
            @Suppress("UNCHECKED_CAST")
            val input = firstArg<List<Map<String, Any?>>>()
            input.map { line ->
                val idx = line["index"] as Int
                val text = line["text"] as String
                SegLineDto(idx, listOf(segWord(text, text)))
            }
        }
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { df ->
                exactEntry(df)
            }
        }
        stubSenseSelectAndTranslate()
    }

    /**
     * Generic sense-select + translate stubs that read the service-built input:
     * select echoes each segment with its first sense's senseId (-1 if none); translate maps senseId → "뜻:{id}".
     */
    private fun stubSenseSelectAndTranslate() {
        every { geminiClient.selectSenses(any(), any()) } answers {
            @Suppress("UNCHECKED_CAST")
            val input = firstArg<List<Map<String, Any?>>>()
            input.map { line ->
                @Suppress("UNCHECKED_CAST")
                val words = (line["segments"] as List<Map<String, Any?>>).map { seg ->
                    @Suppress("UNCHECKED_CAST")
                    val senses = seg["senses"] as List<Map<String, Any?>>
                    val sid = senses.firstOrNull()?.get("senseId") as? Int ?: -1
                    SelectWordDto(
                        senseId = sid,
                        tokenId = seg["tokenId"] as String,
                    )
                }
                SelectLineDto(index = line["index"] as Int, words = words)
            }
        }
        every { geminiClient.translateSenses(any(), any()) } answers {
            @Suppress("UNCHECKED_CAST")
            firstArg<List<Map<String, Any?>>>().map {
                val sid = it["senseId"] as Int
                SenseTranslationDto(senseId = sid, koreanText = "뜻:$sid")
            }
        }
    }

    /**
     * One dictionary entry whose `(headword, reading)` pair matches what [segWord] produces by
     * default, so the pipeline resolves it as [JishoLookupProvenance.EXACT].
     */
    private fun exactEntry(
        word: String,
        reading: String = DEFAULT_READING,
        pos: List<String> = listOf("Noun"),
        english: String = "meaning",
        englishDefinitions: List<String> = listOf(english),
        jlpt: List<String> = listOf("jlpt-n5"),
        distractors: List<JishoOptionDto> = listOf(DISTRACTOR_SENSE),
    ) = JishoEntryDto(
        found = true,
        word = word,
        entries = listOf(
            JishoDictionaryEntryDto(
                headword = word,
                reading = JapaneseText.toKatakana(reading),
                jlpt = jlpt,
                senses = listOf(
                    JishoOptionDto(pos = pos, english = english, englishDefinitions = englishDefinitions),
                ) + distractors,
            ),
        ),
        provenance = JishoLookupProvenance.EXACT,
    )

    private fun rejectedFallbackEntry(
        word: String,
        reading: String = DEFAULT_READING,
        pos: List<String> = listOf("Noun"),
        english: String = "wrong fallback",
    ) = JishoEntryDto(
        found = false,
        word = word,
        entries = listOf(
            JishoDictionaryEntryDto(
                headword = word,
                reading = JapaneseText.toKatakana(reading),
                senses = listOf(JishoOptionDto(pos = pos, english = english, englishDefinitions = listOf(english))),
            ),
        ),
        provenance = JishoLookupProvenance.REJECTED_FALLBACK,
        rejectedFallbackReason = "No exact match",
    )

    /**
     * A segmented word. Readings default to [DEFAULT_READING] so they match [exactEntry]'s default
     * entry and the lookup lands on EXACT; tests that care about a specific reading pass their own.
     */
    private fun segWord(
        surface: String,
        headword: String = surface,
        usedReading: String = DEFAULT_READING,
        baseFormReading: String = usedReading,
        contextGloss: String = "gloss",
    ) = SegWordDto(
        surface = surface,
        headword = headword,
        usedReading = JapaneseText.toKatakana(usedReading),
        baseFormReading = JapaneseText.toKatakana(baseFormReading),
        contextGloss = contextGloss,
    )

    @Test
    fun `golden path - lyric saves analyzed content with tokens and translation`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫が寝る"))

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(
            TranslationResultDto(index = 0, koreanLyrics = "고양이가 잔다"),
        )
        stubHappyPath()

        val ok = processLyric(lyric)

        assertThat(ok).isTrue
        val refreshed = lyricRepository.findById(lyric.id!!).orElseThrow()
        val analyzed = refreshed.analyzedContent!!
        assertThat(analyzed).hasSize(1)
        val line = analyzed[0]
        assertThat(line.koreanLyrics).isEqualTo("고양이가 잔다")
        assertThat(line.tokens.mapNotNull { it.reading }).containsExactly("ヨミ")
        assertThat(line.tokens).isNotEmpty
        assertThat(line.tokens).allSatisfy { token ->
            assertThat(token.koreanText).isNotNull
            assertThat(token.koreanText).startsWith("뜻:")
        }
    }

    @Test
    fun `a word sung on several lines is translated once and reads the same everywhere`(): Unit = runBlocking {
        // 뜻 하나에 senseId 하나. 예전에는 occurrence 마다 id 를 새로 발급해서 같은 sense 가 줄마다
        // 따로 번역됐고, 모델이 줄마다 다른 한국어를 써서 한 단어에 비슷한 뜻이 여러 개 저장됐다.
        val lyric = seedLyric(listOf("シャイ", "シャイ", "シャイ"))
        val translateInputs = mutableListOf<List<Map<String, Any?>>>()

        every { geminiClient.translateLyrics(any(), any()) } returns (0..2).map {
            TranslationResultDto(it, "샤이")
        }
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns (0..2).map {
            SegLineDto(it, listOf(segWord("シャイ", "シャイ", "しゃい")))
        }
        coEvery { jishoService.lookupAll(any()) } returns mapOf(
            "シャイ" to exactEntry("シャイ", reading = "しゃい", pos = listOf("Na-adjective"), english = "shy"),
        )
        stubSenseSelectAndTranslate()
        every { geminiClient.translateSenses(capture(translateInputs), any()) } answers {
            @Suppress("UNCHECKED_CAST")
            firstArg<List<Map<String, Any?>>>().map {
                SenseTranslationDto(senseId = it["senseId"] as Int, koreanText = "수줍다")
            }
        }

        processLyric(lyric)

        assertThat(translateInputs.single()).hasSize(1)
        val analyzed = lyricRepository.findById(lyric.id!!).orElseThrow().analyzedContent!!
        assertThat(analyzed.map { it.tokens.single().koreanText }).containsOnly("수줍다")
    }

    @Test
    fun `non-Japanese tokens are dropped and never reach the dictionary`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫、"))

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(
            TranslationResultDto(0, "고양이"),
        )
        // jisho + select would happily attach a sense even to the comma; it must not get that far.
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { df ->
                exactEntry(df, english = "x")
            }
        }
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("猫", "猫"), segWord("、", "、"))),
        )
        stubSenseSelectAndTranslate()

        processLyric(lyric)

        // The comma stays in the line — the app renders the gap between tokens from the raw text — it
        // just no longer occupies a token of its own.
        val tokens = lyricRepository.findById(lyric.id!!).orElseThrow().analyzedContent!![0].tokens
        assertThat(tokens.map { it.surface }).containsExactly("猫")
        assertThat(tokens.single().partOfSpeech).isNotEqualTo(PartOfSpeech.SYMBOL)
        assertThat(tokens.single().koreanText).isNotNull
        coVerify { jishoService.lookupAll(match { "、" !in it }) }
    }

    @Test
    fun `charStart and charEnd are recomputed by sequential indexOf of surfaces`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫が寝る"))

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(
            TranslationResultDto(0, "고양이가 잔다"),
        )
        coEvery { jishoService.lookupAll(any()) } returns emptyMap()
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(
                0,
                listOf(
                    segWord("猫", "猫"),
                    segWord("が", "が"),
                    segWord("寝る", "寝る"),
                ),
            ),
        )
        stubSenseSelectAndTranslate()

        processLyric(lyric)

        val tokens = lyricRepository.findById(lyric.id!!).orElseThrow().analyzedContent!![0].tokens
        assertThat(tokens.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("猫", 0, 1),
            Triple("が", 1, 2),
            Triple("寝る", 2, 4),
        )
    }

    @Test
    fun `segmentation invalid on first call retries and succeeds`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("目を開けたなら yay"))
        val segmentInputs = mutableListOf<List<Map<String, Any?>>>()
        val temperatures = mutableListOf<Double>()

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(
            TranslationResultDto(0, "눈을 떴다면 yay"),
        )
        every {
            geminiClient.segmentAndLemmatize(capture(segmentInputs), any(), capture(temperatures))
        } returnsMany listOf(
            listOf(SegLineDto(0, listOf(segWord("目", "目"), segWord("を", "を"), segWord("明け", "開ける")))),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        segWord("目", "目"),
                        segWord("を", "を"),
                        segWord("開け", "開ける"),
                        segWord("た", "た"),
                        segWord("なら", "なら"),
                    ),
                ),
            ),
        )
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { exactEntry(it) }
        }
        stubSenseSelectAndTranslate()

        val lines = translationService.runPipeline(lyric)

        assertThat(lines.single().tokens.map { it.surface }).contains("開け")
        verify(exactly = 2) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
        assertThat(segmentInputs).hasSize(2)
        assertThat(segmentInputs[0].single()).doesNotContainKey("previousValidationError")
        assertThat(segmentInputs[1].single()["previousValidationError"] as String)
            .startsWith("Surface '明け' is not present in order at line index=0")
        assertThat(segmentInputs[1].single()["retryInstruction"] as String)
            .contains("previous segmentation output failed validator checks")
        // The retry has to sample. At temperature 0 the model reproduced the rejected array verbatim
        // and every attempt was spent on an output that could not change.
        assertThat(temperatures).containsExactly(0.0, SegmentLyricsStage.SEGMENT_TEMPERATURE_STEP)
    }

    @Test
    fun `retry re-sends only the invalid line and keeps the already valid one`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫が寝る", "目を開けたなら yay"))
        val segmentInputs = mutableListOf<List<Map<String, Any?>>>()

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(
            TranslationResultDto(0, "고양이가 잔다"),
            TranslationResultDto(1, "눈을 떴다면 yay"),
        )
        every { geminiClient.segmentAndLemmatize(capture(segmentInputs), any(), any()) } returnsMany listOf(
            listOf(
                SegLineDto(0, listOf(segWord("猫", "猫"), segWord("が", "が"), segWord("寝る", "寝る"))),
                SegLineDto(1, listOf(segWord("目", "目"), segWord("を", "を"), segWord("明け", "開ける"))),
            ),
            listOf(
                SegLineDto(
                    1,
                    listOf(
                        segWord("目", "目"),
                        segWord("を", "を"),
                        segWord("開け", "開ける"),
                        segWord("た", "た"),
                        segWord("なら", "なら"),
                    ),
                ),
            ),
        )
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { exactEntry(it) }
        }
        stubSenseSelectAndTranslate()

        val lines = translationService.runPipeline(lyric)

        verify(exactly = 2) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
        assertThat(segmentInputs[0].map { it["index"] }).containsExactly(0, 1)
        assertThat(segmentInputs[1].map { it["index"] }).containsExactly(1)
        assertThat(segmentInputs[1].single()["previousValidationError"] as String)
            .startsWith("Surface '明け' is not present in order at line index=1")
        assertThat(lines[0].tokens.map { it.surface }).containsExactly("猫", "が", "寝る")
        assertThat(lines[1].tokens.map { it.surface }).containsExactly("目", "を", "開け", "た", "なら")
    }

    @Test
    fun `segmentation invalid through max retry throws`() {
        val lyric = seedLyric(listOf("目を開けたなら yay"))

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(
            TranslationResultDto(0, "눈을 떴다면 yay"),
        )
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("目", "目"), segWord("を", "を"), segWord("明け", "開ける"))),
        )

        assertThatThrownBy { runBlocking { translationService.runPipeline(lyric) } }
            .isInstanceOf(RuntimeException::class.java)
        verify(exactly = SegmentLyricsStage.MAX_SEGMENTATION_ATTEMPTS) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
        coVerify(exactly = 0) { jishoService.lookupAll(any()) }
    }

    @Test
    fun `rule-resolved-only line skips jisho sense-select and sense-translation`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("てる"))

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(TranslationResultDto(0, "하고 있어"))
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("てる", "てる"))),
        )

        val tokens = translationService.runPipeline(lyric).single().tokens

        assertThat(tokens.single().partOfSpeech).isEqualTo(PartOfSpeech.AUXILIARY_VERB)
        assertThat(tokens.single().koreanText).isEqualTo("~하고 있다")
        coVerify(exactly = 0) { jishoService.lookupAll(any()) }
        verify(exactly = 0) { geminiClient.selectSenses(any(), any()) }
        verify(exactly = 0) { geminiClient.translateSenses(any(), any()) }
    }

    @Test
    fun `mixed rule and jisho line sends only unresolved lexical tokens downstream`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫も"))
        val lookupArgs = mutableListOf<List<String>>()
        val selectInputs = mutableListOf<List<Map<String, Any?>>>()

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(TranslationResultDto(0, "고양이도"))
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("猫", "猫"), segWord("も", "も"))),
        )
        coEvery { jishoService.lookupAll(capture(lookupArgs)) } answers {
            firstArg<List<String>>().associateWith { exactEntry(it) }
        }
        every { geminiClient.selectSenses(capture(selectInputs), any()) } answers {
            @Suppress("UNCHECKED_CAST")
            firstArg<List<Map<String, Any?>>>().map { line ->
                @Suppress("UNCHECKED_CAST")
                val segments = line["segments"] as List<Map<String, Any?>>
                SelectLineDto(
                    0,
                    segments.map {
                        @Suppress("UNCHECKED_CAST")
                        val senses = it["senses"] as List<Map<String, Any?>>
                        SelectWordDto(
                            senseId = senses.first()["senseId"] as Int,
                            tokenId = it["tokenId"] as String,
                        )
                    },
                )
            }
        }
        every { geminiClient.translateSenses(any(), any()) } returns listOf(SenseTranslationDto(0, "고양이"))

        val tokens = translationService.runPipeline(lyric).single().tokens

        assertThat(lookupArgs.flatten()).containsExactly("猫")
        @Suppress("UNCHECKED_CAST")
        val segments = selectInputs.single().single()["segments"] as List<Map<String, Any?>>
        assertThat(segments.map { it["surface"] }).containsExactly("猫")
        assertThat(tokens.map { it.surface to it.koreanText }).containsExactly("猫" to "고양이", "も" to "~도")
    }

    @Test
    fun `a word with one candidate sense is settled in code and never sent to sense-select`(): Unit = runBlocking {
        // 猫 gets a single-sense entry, 犬 gets two. Only 犬 is a choice, so only 犬 may appear in the
        // request — but both must still come back with a meaning.
        val lyric = seedLyric(listOf("猫犬"))
        val selectInputs = mutableListOf<List<Map<String, Any?>>>()

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(TranslationResultDto(0, "고양이 개"))
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("猫", "猫", "ねこ"), segWord("犬", "犬", "いぬ"))),
        )
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith {
                when (it) {
                    "猫" -> exactEntry("猫", reading = "ねこ", english = "cat", distractors = emptyList())
                    "犬" -> exactEntry("犬", reading = "いぬ", english = "dog")
                    else -> JishoEntryDto(found = false, word = it)
                }
            }
        }
        every { geminiClient.selectSenses(capture(selectInputs), any()) } answers {
            @Suppress("UNCHECKED_CAST")
            firstArg<List<Map<String, Any?>>>().map { line ->
                @Suppress("UNCHECKED_CAST")
                val segments = line["segments"] as List<Map<String, Any?>>
                SelectLineDto(
                    line["index"] as Int,
                    segments.map {
                        @Suppress("UNCHECKED_CAST")
                        val senses = it["senses"] as List<Map<String, Any?>>
                        SelectWordDto(senses.first()["senseId"] as Int, it["tokenId"] as String)
                    },
                )
            }
        }
        every { geminiClient.translateSenses(any(), any()) } answers {
            @Suppress("UNCHECKED_CAST")
            firstArg<List<Map<String, Any?>>>().map { SenseTranslationDto(it["senseId"] as Int, "뜻") }
        }

        val tokens = translationService.runPipeline(lyric).single().tokens

        @Suppress("UNCHECKED_CAST")
        val sentSurfaces = selectInputs.flatten()
            .flatMap { it["segments"] as List<Map<String, Any?>> }
            .map { it["surface"] }
        assertThat(sentSurfaces).containsExactly("犬")
        assertThat(tokens.map { it.surface to it.koreanText }).containsExactly("猫" to "뜻", "犬" to "뜻")
    }

    @Test
    fun `a settled word still reaches sense-translate so it gets a meaning`(): Unit = runBlocking {
        // The whole line is unambiguous, so sense-select is skipped entirely — but the senses the code
        // settled on must still be translated, or every token would come back with a null meaning.
        val lyric = seedLyric(listOf("猫"))

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(TranslationResultDto(0, "고양이"))
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("猫", "猫", "ねこ"))),
        )
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith {
                exactEntry(it, reading = "ねこ", english = "cat", distractors = emptyList())
            }
        }
        every { geminiClient.translateSenses(any(), any()) } answers {
            @Suppress("UNCHECKED_CAST")
            firstArg<List<Map<String, Any?>>>().map { SenseTranslationDto(it["senseId"] as Int, "고양이") }
        }

        val token = translationService.runPipeline(lyric).single().tokens.single()

        verify(exactly = 0) { geminiClient.selectSenses(any(), any()) }
        assertThat(token.koreanText).isEqualTo("고양이")
        assertThat(token.partOfSpeech).isEqualTo(PartOfSpeech.NOUN)
    }

    @Test
    fun `i-adjective adverbial normalizes to i-adjective base form and POS`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("高く"))

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(TranslationResultDto(0, "높게"))
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("高く", "高く", usedReading = "タカク", baseFormReading = "タカイ"))),
        )
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith {
                when (it) {
                    "高く" -> rejectedFallbackEntry("高く", reading = "たかくつく", pos = listOf("Expression"), english = "to be expensive")
                    "高い" -> exactEntry("高い", reading = "たかい", pos = listOf("I-adjective"), english = "high / tall", englishDefinitions = listOf("high", "tall"))
                    else -> JishoEntryDto(found = false, word = it)
                }
            }
        }
        stubSenseSelectAndTranslate()
        every { geminiClient.translateSenses(any(), any()) } returns listOf(SenseTranslationDto(0, "높다"))

        val token = translationService.runPipeline(lyric).single().tokens.single()

        assertThat(token.surface).isEqualTo("高く")
        assertThat(token.baseForm).isEqualTo("高い")
        assertThat(token.reading).isEqualTo("タカク")
        assertThat(token.baseFormReading).isEqualTo("タカイ")
        assertThat(token.partOfSpeech).isEqualTo(PartOfSpeech.ADJECTIVE)
        assertThat(token.koreanText).isEqualTo("높다")
    }

    @Test
    fun `rejected fallback does not reach sense-select`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("こうも"))

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(TranslationResultDto(0, "이렇게도"))
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("こうも", "こうも"))),
        )
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { rejectedFallbackEntry(it, english = "item") }
        }

        val token = translationService.runPipeline(lyric).single().tokens.single()

        assertThat(token.partOfSpeech).isEqualTo(PartOfSpeech.OTHER)
        assertThat(token.koreanText).isNull()
        verify(exactly = 0) { geminiClient.selectSenses(any(), any()) }
    }

    @Test
    fun `expression POS from jisho is preserved`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("誰も"))

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(TranslationResultDto(0, "아무도"))
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("誰も", "誰も", "だれも"))),
        )
        coEvery { jishoService.lookupAll(any()) } returns mapOf(
            "誰も" to exactEntry(
                "誰も",
                reading = "だれも",
                pos = listOf("Expressions (phrases, clauses, etc.)"),
                english = "everyone / anyone / no-one",
                englishDefinitions = listOf("everyone", "anyone", "no-one"),
            ),
        )
        stubSenseSelectAndTranslate()
        every { geminiClient.translateSenses(any(), any()) } returns listOf(SenseTranslationDto(0, "아무도"))

        val token = translationService.runPipeline(lyric).single().tokens.single()

        assertThat(token.partOfSpeech).isEqualTo(PartOfSpeech.EXPRESSION)
        assertThat(token.koreanText).isEqualTo("아무도")
    }

    @Test
    fun `massakasama translate-sense input carries lexical identity and definition list`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("真っ逆様"))
        val translateInputs = mutableListOf<List<Map<String, Any?>>>()

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(TranslationResultDto(0, "곤두박질"))
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("真っ逆様", "真っ逆様", "まっさかさま"))),
        )
        coEvery { jishoService.lookupAll(any()) } returns mapOf(
            "真っ逆様" to exactEntry(
                "真っ逆様",
                reading = "まっさかさま",
                pos = listOf("Noun"),
                english = "head over heels / headlong / head first",
                englishDefinitions = listOf("head over heels", "headlong", "head first"),
            ),
        )
        stubSenseSelectAndTranslate()
        every { geminiClient.translateSenses(capture(translateInputs), any()) } returns listOf(SenseTranslationDto(0, "곤두박질"))

        translationService.runPipeline(lyric)

        val input = translateInputs.single().single()
        // 정체성은 baseForm/reading 이다. 표면형은 sense 하나를 여러 줄이 공유하므로 여기 없다.
        assertThat(input).doesNotContainKey("surface")
        assertThat(input["baseForm"]).isEqualTo("真っ逆様")
        assertThat(input["reading"]).isEqualTo("マッサカサマ")
        assertThat(input["englishDefinitions"]).isEqualTo(listOf("head over heels", "headlong", "head first"))
    }

    @Test
    fun `sense-select cannot attach another token candidate senseId`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫犬"))

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(TranslationResultDto(0, "고양이 개"))
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("猫", "猫", "ねこ"), segWord("犬", "犬", "いぬ"))),
        )
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith {
                when (it) {
                    "猫" -> exactEntry("猫", reading = "ねこ", pos = listOf("Noun"), english = "cat")
                    "犬" -> exactEntry("犬", reading = "いぬ", pos = listOf("Noun"), english = "dog")
                    else -> JishoEntryDto(found = false, word = it)
                }
            }
        }
        every { geminiClient.selectSenses(any(), any()) } answers {
            @Suppress("UNCHECKED_CAST")
            val segments = (firstArg<List<Map<String, Any?>>>().single()["segments"] as List<Map<String, Any?>>)
            @Suppress("UNCHECKED_CAST")
            val catSenses = segments[0]["senses"] as List<Map<String, Any?>>
            listOf(
                SelectLineDto(
                    0,
                    listOf(
                        SelectWordDto(
                            senseId = catSenses.first()["senseId"] as Int,
                            tokenId = segments[0]["tokenId"] as String,
                        ),
                        SelectWordDto(
                            senseId = catSenses.first()["senseId"] as Int,
                            tokenId = segments[1]["tokenId"] as String,
                        ),
                    ),
                ),
            )
        }
        every { geminiClient.translateSenses(any(), any()) } answers {
            @Suppress("UNCHECKED_CAST")
            firstArg<List<Map<String, Any?>>>().map {
                SenseTranslationDto(it["senseId"] as Int, "고양이")
            }
        }

        val tokens = translationService.runPipeline(lyric).single().tokens

        val cat = tokens.single { it.surface == "猫" }
        val dog = tokens.single { it.surface == "犬" }
        assertThat(cat.koreanText).isEqualTo("고양이")
        assertThat(dog.koreanText).isNull()
        // Nothing dictionary-derived may leak onto the rejected token. Its readings still come from
        // segmentation, which never depended on the lookup.
        assertThat(dog.partOfSpeech).isEqualTo(PartOfSpeech.OTHER)
        assertThat(dog.jlpt).isNull()
        assertThat(dog.reading).isEqualTo("イヌ")
    }

    @Test
    fun `sense-select splits a long song into chunks instead of one call`(): Unit = runBlocking {
        val lineCount = SelectSensesStage.SELECT_CHUNK_LINES + 5
        val lyric = seedLyric((0 until lineCount).map { "猫$it" })
        val selectInputs = mutableListOf<List<Map<String, Any?>>>()

        every { geminiClient.translateLyrics(any(), any()) } returns (0 until lineCount).map {
            TranslationResultDto(it, "고양이$it")
        }
        stubHappyPath()

        val lines = translationService.runPipeline(lyric)

        verify(exactly = 2) { geminiClient.selectSenses(capture(selectInputs), any()) }
        assertThat(selectInputs.map { it.size })
            .containsExactly(SelectSensesStage.SELECT_CHUNK_LINES, 5)
        assertThat(selectInputs.flatMap { chunk -> chunk.map { it["index"] } })
            .isEqualTo((0 until lineCount).toList())
        assertThat(lines).hasSize(lineCount)
        assertThat(lines).allSatisfy { line ->
            assertThat(line.tokens.single().koreanText).startsWith("뜻:")
        }
    }

    @Test
    fun `sense-select duplicate line indices fail instead of overwriting`() {
        val lyric = seedLyric(listOf("猫", "犬"))

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(
            TranslationResultDto(0, "고양이"),
            TranslationResultDto(1, "개"),
        )
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("猫", "猫", "ねこ"))),
            SegLineDto(1, listOf(segWord("犬", "犬", "いぬ"))),
        )
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith {
                when (it) {
                    "猫" -> exactEntry("猫", reading = "ねこ", pos = listOf("Noun"), english = "cat")
                    "犬" -> exactEntry("犬", reading = "いぬ", pos = listOf("Noun"), english = "dog")
                    else -> JishoEntryDto(found = false, word = it)
                }
            }
        }
        every { geminiClient.selectSenses(any(), any()) } answers {
            @Suppress("UNCHECKED_CAST")
            val input = firstArg<List<Map<String, Any?>>>()
            @Suppress("UNCHECKED_CAST")
            val firstSegment = (input[0]["segments"] as List<Map<String, Any?>>).single()
            @Suppress("UNCHECKED_CAST")
            val secondSegment = (input[1]["segments"] as List<Map<String, Any?>>).single()
            @Suppress("UNCHECKED_CAST")
            val firstSenses = firstSegment["senses"] as List<Map<String, Any?>>
            @Suppress("UNCHECKED_CAST")
            val secondSenses = secondSegment["senses"] as List<Map<String, Any?>>
            listOf(
                SelectLineDto(
                    0,
                    listOf(
                        SelectWordDto(
                            senseId = firstSenses.first()["senseId"] as Int,
                            tokenId = firstSegment["tokenId"] as String,
                        ),
                    ),
                ),
                SelectLineDto(
                    0,
                    listOf(
                        SelectWordDto(
                            senseId = secondSenses.first()["senseId"] as Int,
                            tokenId = secondSegment["tokenId"] as String,
                        ),
                    ),
                ),
            )
        }

        assertThatThrownBy { runBlocking { translationService.runPipeline(lyric) } }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("duplicate line indices")
    }

    @Test
    fun `translation duplicate line indices fail instead of overwriting`() {
        val lyric = seedLyric(listOf("猫", "犬"))

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(
            TranslationResultDto(0, "고양이"),
            TranslationResultDto(0, "개"),
        )
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("猫", "猫", "ねこ"))),
            SegLineDto(1, listOf(segWord("犬", "犬", "いぬ"))),
        )
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { exactEntry(it) }
        }
        stubSenseSelectAndTranslate()

        assertThatThrownBy { runBlocking { translationService.runPipeline(lyric) } }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("duplicate line indices")
    }

    @Test
    fun `pipeline failure does not save analyzed content`() {
        val lyric = seedLyric(listOf("猫"))

        every { geminiClient.translateLyrics(any(), any()) } throws RuntimeException("boom")
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } throws RuntimeException("boom")

        assertThatThrownBy { runBlocking { translationService.runPipeline(lyric) } }
            .isInstanceOf(RuntimeException::class.java)

        val refreshed = lyricRepository.findById(lyric.id!!).orElseThrow()
        assertThat(refreshed.analyzedContent).isNullOrEmpty()
    }

    @Test
    fun `pipeline failure does not mark lyric terminal state`() {
        val lyric = seedLyric(listOf("猫"))

        every { geminiClient.translateLyrics(any(), any()) } throws RuntimeException("permanent failure")
        every { geminiClient.segmentAndLemmatize(any(), any(), any()) } throws RuntimeException("permanent failure")

        assertThatThrownBy { runBlocking { translationService.runPipeline(lyric) } }
            .isInstanceOf(RuntimeException::class.java)

        val refreshed = lyricRepository.findById(lyric.id!!).orElseThrow()
        assertThat(refreshed.analyzedContent).isNullOrEmpty()
    }

    @Test
    fun `translation and segmentation calls run in parallel via coroutineScope`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫"))

        every { geminiClient.translateLyrics(any(), any()) } returns listOf(TranslationResultDto(0, "고양이"))
        stubHappyPath()

        processLyric(lyric)

        verify(exactly = 1) { geminiClient.translateLyrics(any(), any()) }
        verify(exactly = 1) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
        verify(exactly = 1) { geminiClient.selectSenses(any(), any()) }
        verify(exactly = 1) { geminiClient.translateSenses(any(), any()) }
    }

    @Test
    fun `work claim marks oldest PENDING entries as RUNNING up to batch size`() {
        val all = (1..7).map { seedWork("猫$it") }

        val claimed = workService.claimPending(
            limit = 5,
            workerId = "test-worker",
            lockUntil = Instant.now().plus(Duration.ofMinutes(30)),
        )

        assertThat(claimed).hasSize(5)
        val statuses = all.map { workRepository.findById(it.id!!).orElseThrow().status }
        assertThat(statuses.count { it == SongAnalysisWorkStatus.RUNNING }).isEqualTo(5)
        assertThat(statuses.count { it == SongAnalysisWorkStatus.PENDING }).isEqualTo(2)
        assertThat(claimed.map { it.id }).containsExactlyElementsOf(all.take(5).map { it.id })
    }

    @Test
    fun `work claim ignores terminal rows`() {
        seedWork("失敗", status = SongAnalysisWorkStatus.FAILED)

        val claimed = workService.claimPending(
            limit = 5,
            workerId = "test-worker",
            lockUntil = Instant.now().plus(Duration.ofMinutes(30)),
        )

        assertThat(claimed).isEmpty()
        verify(exactly = 0) { geminiClient.translateLyrics(any(), any()) }
        verify(exactly = 0) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
    }

    @Test
    fun `expired RUNNING work is failed instead of reclaimed`() {
        val expired = seedWork("期限切れ", status = SongAnalysisWorkStatus.RUNNING).apply {
            lockedBy = "dead-worker"
            lockedUntil = Instant.now().minus(Duration.ofMinutes(1))
        }
        workRepository.saveAndFlush(expired)

        val claimed = workService.claimPending(
            limit = 5,
            workerId = "new-worker",
            lockUntil = Instant.now().plus(Duration.ofMinutes(30)),
        )
        val failedCount = workService.failExpiredRunning(limit = 5)

        assertThat(claimed).isEmpty()
        assertThat(failedCount).isEqualTo(1)
        val refreshed = workRepository.findById(expired.id!!).orElseThrow()
        assertThat(refreshed.status).isEqualTo(SongAnalysisWorkStatus.FAILED)
        assertThat(refreshed.activeDedupKey).isNull()
        assertThat(refreshed.errorCode).isEqualTo("SONG_ANALYSIS_WORK_TIMEOUT")
    }

    @Test
    fun `stale worker cannot complete work after timeout failure`() {
        val expired = seedWork("復活禁止", status = SongAnalysisWorkStatus.RUNNING).apply {
            lockedBy = "dead-worker"
            lockedUntil = Instant.now().minus(Duration.ofMinutes(1))
        }
        workRepository.saveAndFlush(expired)

        workService.failExpiredRunning(limit = 5)
        val completed = workService.markCompleted(expired.id!!, "dead-worker")
        val failedAgain = workService.markFailed(
            expired.id!!,
            "dead-worker",
            "SONG_ANALYSIS_WORK_FAILED",
            "unsafe overwrite",
        )

        assertThat(completed).isFalse
        assertThat(failedAgain).isFalse
        val refreshed = workRepository.findById(expired.id!!).orElseThrow()
        assertThat(refreshed.status).isEqualTo(SongAnalysisWorkStatus.FAILED)
        assertThat(refreshed.errorCode).isEqualTo("SONG_ANALYSIS_WORK_TIMEOUT")
        assertThat(refreshed.errorMessage).isEqualTo("Song analysis timed out")
    }

    @Test
    fun `stale worker cannot save analyzed content after timeout failure`() {
        val lyric = seedLyric(listOf("猫"))
        val expired = seedWork("副作用禁止", status = SongAnalysisWorkStatus.RUNNING).apply {
            lyricId = lyric.id
            lockedBy = "dead-worker"
            lockedUntil = Instant.now().minus(Duration.ofMinutes(1))
        }
        workRepository.saveAndFlush(expired)

        workService.failExpiredRunning(limit = 5)
        val completed = completionService.completeWithAnalyzedContent(
            workId = expired.id!!,
            workerId = "dead-worker",
            lyricId = lyric.id!!,
            analyzedLines = listOf(AnalyzedLine(index = 0, koreanLyrics = "고양이", tokens = emptyList())),
        )

        assertThat(completed).isFalse
        val refreshedWork = workRepository.findById(expired.id!!).orElseThrow()
        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.FAILED)
        assertThat(refreshedWork.errorCode).isEqualTo("SONG_ANALYSIS_WORK_TIMEOUT")
        val refreshedLyric = lyricRepository.findById(lyric.id!!).orElseThrow()
        assertThat(refreshedLyric.analyzedContent).isNull()
    }
}
