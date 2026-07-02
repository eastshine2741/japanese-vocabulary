package com.japanese.vocabulary.translation.service

import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.SenseTranslationDto
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
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

    private suspend fun processLyric(lyric: LyricEntity): Boolean {
        val lines = translationService.runPipeline(lyric)
        translationService.saveAnalyzedContent(lyric, lines)
        return true
    }

    /**
     * Stub the redesigned pipeline so it round-trips deterministically:
     * - segment: one word per line whose surface/dictionaryForm = the whole line text.
     * - jisho: every dictForm → one option (reading ヨミ, Noun, jlpt-n5), so a senseId exists.
     * - sense-select: pick the first sense's senseId per segment (or -1 when none).
     * - translate-sense: koreanText = "뜻:{senseId}".
     */
    private fun stubHappyPath() {
        every { geminiClient.segmentAndLemmatize(any()) } answers {
            @Suppress("UNCHECKED_CAST")
            val input = firstArg<List<Map<String, Any?>>>()
            input.map { line ->
                val idx = line["index"] as Int
                val text = line["text"] as String
                SegLineDto(idx, listOf(SegWordDto(surface = text, dictionaryForm = text)))
            }
        }
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { df ->
                JishoEntryDto(
                    found = true,
                    word = df,
                    options = listOf(
                        JishoOptionDto(reading = "ヨミ", pos = listOf("Noun"), english = "meaning", jlpt = listOf("jlpt-n5")),
                    ),
                    provenance = JishoLookupProvenance.EXACT,
                )
            }
        }
        stubSenseSelectAndTranslate()
    }

    /**
     * Generic sense-select + translate stubs that read the service-built input:
     * select echoes each segment with its first sense's senseId (-1 if none); translate maps senseId → "뜻:{id}".
     */
    private fun stubSenseSelectAndTranslate() {
        every { geminiClient.selectSenses(any()) } answers {
            @Suppress("UNCHECKED_CAST")
            val input = firstArg<List<Map<String, Any?>>>()
            input.map { line ->
                @Suppress("UNCHECKED_CAST")
                val words = (line["segments"] as List<Map<String, Any?>>).map { seg ->
                    @Suppress("UNCHECKED_CAST")
                    val senses = seg["senses"] as List<Map<String, Any?>>
                    val sid = senses.firstOrNull()?.get("senseId") as? Int ?: -1
                    SelectWordDto(
                        surface = seg["surface"] as String,
                        dictionaryForm = seg["dictionaryForm"] as String,
                        senseId = sid,
                        tokenId = seg["tokenId"] as String,
                    )
                }
                SelectLineDto(index = line["index"] as Int, words = words)
            }
        }
        every { geminiClient.translateSenses(any()) } answers {
            @Suppress("UNCHECKED_CAST")
            firstArg<List<Map<String, Any?>>>().map {
                val sid = it["senseId"] as Int
                SenseTranslationDto(senseId = sid, koreanText = "뜻:$sid")
            }
        }
    }

    private fun exactEntry(
        word: String,
        reading: String = "ヨミ",
        pos: List<String> = listOf("Noun"),
        english: String = "meaning",
        englishDefinitions: List<String> = listOf(english),
        jlpt: List<String> = listOf("jlpt-n5"),
    ) = JishoEntryDto(
        found = true,
        word = word,
        options = listOf(
            JishoOptionDto(
                reading = reading,
                pos = pos,
                english = english,
                jlpt = jlpt,
                englishDefinitions = englishDefinitions,
            ),
        ),
        provenance = JishoLookupProvenance.EXACT,
    )

    private fun rejectedFallbackEntry(
        word: String,
        reading: String = "ヨミ",
        pos: List<String> = listOf("Noun"),
        english: String = "wrong fallback",
    ) = JishoEntryDto(
        found = false,
        word = word,
        options = listOf(JishoOptionDto(reading = reading, pos = pos, english = english, englishDefinitions = listOf(english))),
        provenance = JishoLookupProvenance.REJECTED_FALLBACK,
        rejectedFallbackReason = "No exact match",
    )

    @Test
    fun `golden path - lyric saves analyzed content with tokens and translation`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫が寝る"))

        every { geminiClient.translateLyrics(any()) } returns listOf(
            TranslationResultDto(index = 0, koreanLyrics = "고양이가 잔다", koreanPronounciation = "네코가 네루"),
        )
        stubHappyPath()

        val ok = processLyric(lyric)

        assertThat(ok).isTrue
        val refreshed = lyricRepository.findById(lyric.id!!).orElseThrow()
        val analyzed = refreshed.analyzedContent!!
        assertThat(analyzed).hasSize(1)
        val line = analyzed[0]
        assertThat(line.koreanLyrics).isEqualTo("고양이가 잔다")
        assertThat(line.koreanPronounciation).isEqualTo("네코가 네루")
        assertThat(line.tokens).isNotEmpty
        assertThat(line.tokens).allSatisfy { token ->
            assertThat(token.koreanText).isNotNull
            assertThat(token.koreanText).startsWith("뜻:")
        }
    }

    @Test
    fun `non-Japanese tokens are marked SYMBOL with no meaning`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫、"))

        every { geminiClient.translateLyrics(any()) } returns listOf(
            TranslationResultDto(0, "고양이", "네코"),
        )
        // jisho + select would happily attach a sense even to the comma; the SYMBOL guard must override.
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { df ->
                JishoEntryDto(
                    found = true,
                    word = df,
                    options = listOf(JishoOptionDto("ヨミ", listOf("Noun"), "x", listOf("jlpt-n5"))),
                    provenance = JishoLookupProvenance.EXACT,
                )
            }
        }
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto("猫", "猫"), SegWordDto("、", "、"))),
        )
        stubSenseSelectAndTranslate()

        processLyric(lyric)

        val tokens = lyricRepository.findById(lyric.id!!).orElseThrow().analyzedContent!![0].tokens
        val cat = tokens.first { it.surface == "猫" }
        val comma = tokens.first { it.surface == "、" }
        assertThat(cat.partOfSpeech).isNotEqualTo(PartOfSpeech.SYMBOL)
        assertThat(cat.koreanText).isNotNull
        assertThat(comma.partOfSpeech).isEqualTo(PartOfSpeech.SYMBOL)
        assertThat(comma.koreanText).isNull()
        assertThat(comma.reading).isNull()
        assertThat(comma.jlpt).isNull()
    }

    @Test
    fun `charStart and charEnd are recomputed by sequential indexOf of surfaces`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫が寝る"))

        every { geminiClient.translateLyrics(any()) } returns listOf(
            TranslationResultDto(0, "고양이가 잔다", "네코가 네루"),
        )
        coEvery { jishoService.lookupAll(any()) } returns emptyMap()
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(
                0,
                listOf(
                    SegWordDto("猫", "猫"),
                    SegWordDto("が", "が"),
                    SegWordDto("寝る", "寝る"),
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

        every { geminiClient.translateLyrics(any()) } returns listOf(
            TranslationResultDto(0, "눈을 떴다면 yay", "메오 아케타나라 야이"),
        )
        every { geminiClient.segmentAndLemmatize(any()) } returnsMany listOf(
            listOf(SegLineDto(0, listOf(SegWordDto("目", "目"), SegWordDto("を", "を"), SegWordDto("明け", "開ける")))),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        SegWordDto("目", "目"),
                        SegWordDto("を", "を"),
                        SegWordDto("開け", "開ける"),
                        SegWordDto("た", "た"),
                        SegWordDto("なら", "なら"),
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
        verify(exactly = 2) { geminiClient.segmentAndLemmatize(any()) }
    }

    @Test
    fun `segmentation invalid through max retry throws`() {
        val lyric = seedLyric(listOf("目を開けたなら yay"))

        every { geminiClient.translateLyrics(any()) } returns listOf(
            TranslationResultDto(0, "눈을 떴다면 yay", "메오 아케타나라 야이"),
        )
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto("目", "目"), SegWordDto("を", "を"), SegWordDto("明け", "開ける"))),
        )

        assertThatThrownBy { runBlocking { translationService.runPipeline(lyric) } }
            .isInstanceOf(RuntimeException::class.java)
        verify(exactly = 2) { geminiClient.segmentAndLemmatize(any()) }
        coVerify(exactly = 0) { jishoService.lookupAll(any()) }
    }

    @Test
    fun `rule-resolved-only line skips jisho sense-select and sense-translation`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("てる"))

        every { geminiClient.translateLyrics(any()) } returns listOf(TranslationResultDto(0, "하고 있어", "테루"))
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto("てる", "てる"))),
        )

        val tokens = translationService.runPipeline(lyric).single().tokens

        assertThat(tokens.single().partOfSpeech).isEqualTo(PartOfSpeech.AUXILIARY_VERB)
        assertThat(tokens.single().koreanText).isEqualTo("~하고 있다")
        coVerify(exactly = 0) { jishoService.lookupAll(any()) }
        verify(exactly = 0) { geminiClient.selectSenses(any()) }
        verify(exactly = 0) { geminiClient.translateSenses(any()) }
    }

    @Test
    fun `mixed rule and jisho line sends only unresolved lexical tokens downstream`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫も"))
        val lookupArgs = mutableListOf<List<String>>()
        val selectInputs = mutableListOf<List<Map<String, Any?>>>()

        every { geminiClient.translateLyrics(any()) } returns listOf(TranslationResultDto(0, "고양이도", "네코모"))
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto("猫", "猫"), SegWordDto("も", "も"))),
        )
        coEvery { jishoService.lookupAll(capture(lookupArgs)) } answers {
            firstArg<List<String>>().associateWith { exactEntry(it) }
        }
        every { geminiClient.selectSenses(capture(selectInputs)) } answers {
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
                            surface = it["surface"] as String,
                            dictionaryForm = it["dictionaryForm"] as String,
                            senseId = senses.first()["senseId"] as Int,
                            tokenId = it["tokenId"] as String,
                        )
                    },
                )
            }
        }
        every { geminiClient.translateSenses(any()) } returns listOf(SenseTranslationDto(0, "고양이"))

        val tokens = translationService.runPipeline(lyric).single().tokens

        assertThat(lookupArgs.flatten()).containsExactly("猫")
        @Suppress("UNCHECKED_CAST")
        val segments = selectInputs.single().single()["segments"] as List<Map<String, Any?>>
        assertThat(segments.map { it["surface"] }).containsExactly("猫")
        assertThat(tokens.map { it.surface to it.koreanText }).containsExactly("猫" to "고양이", "も" to "~도")
    }

    @Test
    fun `i-adjective adverbial normalizes to i-adjective base form and POS`() = runBlocking {
        val lyric = seedLyric(listOf("高く"))

        every { geminiClient.translateLyrics(any()) } returns listOf(TranslationResultDto(0, "높게", "타카쿠"))
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto("高く", "高く"))),
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
        every { geminiClient.translateSenses(any()) } returns listOf(SenseTranslationDto(0, "높다"))

        val token = translationService.runPipeline(lyric).single().tokens.single()

        assertThat(token.surface).isEqualTo("高く")
        assertThat(token.baseForm).isEqualTo("高い")
        assertThat(token.reading).isEqualTo("たかい")
        assertThat(token.partOfSpeech).isEqualTo(PartOfSpeech.ADJECTIVE)
        assertThat(token.koreanText).isEqualTo("높다")
    }

    @Test
    fun `rejected fallback does not reach sense-select`() = runBlocking {
        val lyric = seedLyric(listOf("こうも"))

        every { geminiClient.translateLyrics(any()) } returns listOf(TranslationResultDto(0, "이렇게도", "코우모"))
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto("こうも", "こうも"))),
        )
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { rejectedFallbackEntry(it, english = "item") }
        }

        val token = translationService.runPipeline(lyric).single().tokens.single()

        assertThat(token.partOfSpeech).isEqualTo(PartOfSpeech.OTHER)
        assertThat(token.koreanText).isNull()
        verify(exactly = 0) { geminiClient.selectSenses(any()) }
    }

    @Test
    fun `expression POS from jisho is preserved`() = runBlocking {
        val lyric = seedLyric(listOf("誰も"))

        every { geminiClient.translateLyrics(any()) } returns listOf(TranslationResultDto(0, "아무도", "다레모"))
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto("誰も", "誰も"))),
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
        every { geminiClient.translateSenses(any()) } returns listOf(SenseTranslationDto(0, "아무도"))

        val token = translationService.runPipeline(lyric).single().tokens.single()

        assertThat(token.partOfSpeech).isEqualTo(PartOfSpeech.EXPRESSION)
        assertThat(token.koreanText).isEqualTo("아무도")
    }

    @Test
    fun `massakasama translate-sense input carries lexical identity and definition list`() = runBlocking {
        val lyric = seedLyric(listOf("真っ逆様"))
        val translateInputs = mutableListOf<List<Map<String, Any?>>>()

        every { geminiClient.translateLyrics(any()) } returns listOf(TranslationResultDto(0, "곤두박질", "맛사카사마"))
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto("真っ逆様", "真っ逆様"))),
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
        every { geminiClient.translateSenses(capture(translateInputs)) } returns listOf(SenseTranslationDto(0, "곤두박질"))

        translationService.runPipeline(lyric)

        val input = translateInputs.single().single()
        assertThat(input["surface"]).isEqualTo("真っ逆様")
        assertThat(input["baseForm"]).isEqualTo("真っ逆様")
        assertThat(input["reading"]).isEqualTo("まっさかさま")
        assertThat(input["englishDefinitions"]).isEqualTo(listOf("head over heels", "headlong", "head first"))
    }

    @Test
    fun `sense-select cannot attach another token candidate senseId`() = runBlocking {
        val lyric = seedLyric(listOf("猫犬"))

        every { geminiClient.translateLyrics(any()) } returns listOf(TranslationResultDto(0, "고양이 개", "네코 이누"))
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto("猫", "猫"), SegWordDto("犬", "犬"))),
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
        every { geminiClient.selectSenses(any()) } answers {
            @Suppress("UNCHECKED_CAST")
            val segments = (firstArg<List<Map<String, Any?>>>().single()["segments"] as List<Map<String, Any?>>)
            @Suppress("UNCHECKED_CAST")
            val catSenses = segments[0]["senses"] as List<Map<String, Any?>>
            listOf(
                SelectLineDto(
                    0,
                    listOf(
                        SelectWordDto(
                            surface = "猫",
                            dictionaryForm = "猫",
                            senseId = catSenses.first()["senseId"] as Int,
                            tokenId = segments[0]["tokenId"] as String,
                        ),
                        SelectWordDto(
                            surface = "犬",
                            dictionaryForm = "犬",
                            senseId = catSenses.first()["senseId"] as Int,
                            tokenId = segments[1]["tokenId"] as String,
                        ),
                    ),
                ),
            )
        }
        every { geminiClient.translateSenses(any()) } answers {
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
        assertThat(dog.reading).isNull()
    }

    @Test
    fun `sense-select duplicate line indices fail instead of overwriting`() {
        val lyric = seedLyric(listOf("猫", "犬"))

        every { geminiClient.translateLyrics(any()) } returns listOf(
            TranslationResultDto(0, "고양이", "네코"),
            TranslationResultDto(1, "개", "이누"),
        )
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto("猫", "猫"))),
            SegLineDto(1, listOf(SegWordDto("犬", "犬"))),
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
        every { geminiClient.selectSenses(any()) } answers {
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
                            surface = firstSegment["surface"] as String,
                            dictionaryForm = firstSegment["dictionaryForm"] as String,
                            senseId = firstSenses.first()["senseId"] as Int,
                            tokenId = firstSegment["tokenId"] as String,
                        ),
                    ),
                ),
                SelectLineDto(
                    0,
                    listOf(
                        SelectWordDto(
                            surface = secondSegment["surface"] as String,
                            dictionaryForm = secondSegment["dictionaryForm"] as String,
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

        every { geminiClient.translateLyrics(any()) } returns listOf(
            TranslationResultDto(0, "고양이", "네코"),
            TranslationResultDto(0, "개", "이누"),
        )
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto("猫", "猫"))),
            SegLineDto(1, listOf(SegWordDto("犬", "犬"))),
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

        every { geminiClient.translateLyrics(any()) } throws RuntimeException("boom")
        every { geminiClient.segmentAndLemmatize(any()) } throws RuntimeException("boom")

        assertThatThrownBy { runBlocking { translationService.runPipeline(lyric) } }
            .isInstanceOf(RuntimeException::class.java)

        val refreshed = lyricRepository.findById(lyric.id!!).orElseThrow()
        assertThat(refreshed.analyzedContent).isNullOrEmpty()
    }

    @Test
    fun `pipeline failure does not mark lyric terminal state`() {
        val lyric = seedLyric(listOf("猫"))

        every { geminiClient.translateLyrics(any()) } throws RuntimeException("permanent failure")
        every { geminiClient.segmentAndLemmatize(any()) } throws RuntimeException("permanent failure")

        assertThatThrownBy { runBlocking { translationService.runPipeline(lyric) } }
            .isInstanceOf(RuntimeException::class.java)

        val refreshed = lyricRepository.findById(lyric.id!!).orElseThrow()
        assertThat(refreshed.analyzedContent).isNullOrEmpty()
    }

    @Test
    fun `translation and segmentation calls run in parallel via coroutineScope`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫"))

        every { geminiClient.translateLyrics(any()) } returns listOf(TranslationResultDto(0, "고양이", "네코"))
        stubHappyPath()

        processLyric(lyric)

        verify(exactly = 1) { geminiClient.translateLyrics(any()) }
        verify(exactly = 1) { geminiClient.segmentAndLemmatize(any()) }
        verify(exactly = 1) { geminiClient.selectSenses(any()) }
        verify(exactly = 1) { geminiClient.translateSenses(any()) }
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
        verify(exactly = 0) { geminiClient.translateLyrics(any()) }
        verify(exactly = 0) { geminiClient.segmentAndLemmatize(any()) }
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
            analyzedLines = listOf(AnalyzedLine(0, "고양이", "네코", emptyList())),
        )

        assertThat(completed).isFalse
        val refreshedWork = workRepository.findById(expired.id!!).orElseThrow()
        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.FAILED)
        assertThat(refreshedWork.errorCode).isEqualTo("SONG_ANALYSIS_WORK_TIMEOUT")
        val refreshedLyric = lyricRepository.findById(lyric.id!!).orElseThrow()
        assertThat(refreshedLyric.analyzedContent).isNull()
    }
}
