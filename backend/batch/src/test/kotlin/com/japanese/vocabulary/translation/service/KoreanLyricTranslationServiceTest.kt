package com.japanese.vocabulary.translation.service

import com.japanese.vocabulary.translation.batch.KoreanLyricTranslationScheduler
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.SenseTranslationDto
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import io.mockk.coEvery
import io.mockk.every
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

class KoreanLyricTranslationServiceTest : BatchBaseIntegrationTest() {

    @Autowired private lateinit var scheduler: KoreanLyricTranslationScheduler
    @Autowired private lateinit var lyricRepository: LyricRepository
    @Autowired private lateinit var songRepository: SongRepository

    private fun seedLyric(
        lines: List<String>,
        status: KoreanLyricStatus = KoreanLyricStatus.PENDING,
        retryCount: Int = 0,
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
                status = status,
                retryCount = retryCount,
            ),
        )
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
                    SelectWordDto(seg["surface"] as String, seg["dictionaryForm"] as String, sid)
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

    @Test
    fun `golden path - PENDING lyric becomes COMPLETED with tokens and translation`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫が寝る"))

        every { geminiClient.translateLyrics(any()) } returns listOf(
            TranslationResultDto(index = 0, koreanLyrics = "고양이가 잔다", koreanPronounciation = "네코가 네루"),
        )
        stubHappyPath()

        val ok = scheduler.processOne(lyric)

        assertThat(ok).isTrue
        val refreshed = lyricRepository.findById(lyric.id!!).orElseThrow()
        assertThat(refreshed.status).isEqualTo(KoreanLyricStatus.COMPLETED)
        assertThat(refreshed.retryCount).isZero
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
                JishoEntryDto(true, df, listOf(JishoOptionDto("ヨミ", listOf("Noun"), "x", listOf("jlpt-n5"))))
            }
        }
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto("猫", "猫"), SegWordDto("、", "、"))),
        )
        stubSenseSelectAndTranslate()

        scheduler.processOne(lyric)

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

        scheduler.processOne(lyric)

        val tokens = lyricRepository.findById(lyric.id!!).orElseThrow().analyzedContent!![0].tokens
        assertThat(tokens.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("猫", 0, 1),
            Triple("が", 1, 2),
            Triple("寝る", 2, 4),
        )
    }

    @Test
    fun `failure under MAX_RETRIES bumps retryCount and resets status to PENDING`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫"))

        every { geminiClient.translateLyrics(any()) } throws RuntimeException("boom")
        every { geminiClient.segmentAndLemmatize(any()) } throws RuntimeException("boom")

        val ok = scheduler.processOne(lyric)

        assertThat(ok).isFalse
        val refreshed = lyricRepository.findById(lyric.id!!).orElseThrow()
        assertThat(refreshed.status).isEqualTo(KoreanLyricStatus.PENDING)
        assertThat(refreshed.retryCount).isEqualTo(1)
        assertThat(refreshed.analyzedContent).isNullOrEmpty()
    }

    @Test
    fun `failure at last attempt marks lyric FAILED with retryCount=MAX_RETRIES`(): Unit = runBlocking {
        // Seed already at retryCount=2; one more failure will hit MAX_RETRIES=3.
        val lyric = seedLyric(listOf("猫"), retryCount = 2)

        every { geminiClient.translateLyrics(any()) } throws RuntimeException("permanent failure")
        every { geminiClient.segmentAndLemmatize(any()) } throws RuntimeException("permanent failure")

        val ok = scheduler.processOne(lyric)

        assertThat(ok).isFalse
        val refreshed = lyricRepository.findById(lyric.id!!).orElseThrow()
        assertThat(refreshed.status).isEqualTo(KoreanLyricStatus.FAILED)
        assertThat(refreshed.retryCount).isEqualTo(3)
    }

    @Test
    fun `translation and segmentation calls run in parallel via coroutineScope`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫"))

        every { geminiClient.translateLyrics(any()) } returns listOf(TranslationResultDto(0, "고양이", "네코"))
        stubHappyPath()

        scheduler.processOne(lyric)

        verify(exactly = 1) { geminiClient.translateLyrics(any()) }
        verify(exactly = 1) { geminiClient.segmentAndLemmatize(any()) }
        verify(exactly = 1) { geminiClient.selectSenses(any()) }
        verify(exactly = 1) { geminiClient.translateSenses(any()) }
    }

    @Test
    fun `scheduler claim marks oldest PENDING entries as PROCESSING up to BATCH_SIZE`() {
        // Slow-stub Gemini so the async portion does not race ahead and flip PROCESSING → COMPLETED
        // before we can read.
        every { geminiClient.translateLyrics(any()) } answers {
            Thread.sleep(2_000); listOf(TranslationResultDto(0, "x", "y"))
        }
        stubHappyPath()

        val all = (1..7).map { seedLyric(listOf("猫$it")) }

        scheduler.run()

        val statuses = all.map { lyricRepository.findById(it.id!!).orElseThrow().status }
        val processingCount = statuses.count { it == KoreanLyricStatus.PROCESSING }
        val pendingCount = statuses.count { it == KoreanLyricStatus.PENDING }
        assertThat(processingCount + pendingCount).isEqualTo(7)
        assertThat(processingCount).isEqualTo(5)
        assertThat(pendingCount).isEqualTo(2)

        val oldest5Ids = all.take(5).map { it.id!! }.toSet()
        val processingIds = all
            .filter { lyricRepository.findById(it.id!!).orElseThrow().status == KoreanLyricStatus.PROCESSING }
            .map { it.id!! }
            .toSet()
        assertThat(processingIds).isEqualTo(oldest5Ids)
    }

    @Test
    fun `scheduler run is a no-op when there are no PENDING lyrics`() {
        seedLyric(listOf("猫"), status = KoreanLyricStatus.COMPLETED)

        scheduler.run()

        verify(exactly = 0) { geminiClient.translateLyrics(any()) }
        verify(exactly = 0) { geminiClient.segmentAndLemmatize(any()) }
    }
}
