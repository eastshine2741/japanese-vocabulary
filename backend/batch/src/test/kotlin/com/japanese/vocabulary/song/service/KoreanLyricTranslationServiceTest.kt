package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.client.gemini.dto.TranslationResult
import com.japanese.vocabulary.song.client.gemini.dto.WordMeaning
import com.japanese.vocabulary.song.client.gemini.dto.WordMeaningResult
import com.japanese.vocabulary.song.dto.LyricLineData
import com.japanese.vocabulary.song.dto.PartOfSpeech
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import io.mockk.every
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

class KoreanLyricTranslationServiceTest : BatchBaseIntegrationTest() {

    @Autowired private lateinit var service: KoreanLyricTranslationService
    @Autowired private lateinit var lyricRepository: LyricRepository
    @Autowired private lateinit var songRepository: SongRepository

    @AfterEach
    fun cleanup() {
        jdbcTemplate.execute("DELETE FROM lyrics")
        jdbcTemplate.execute("DELETE FROM songs")
    }

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

    @Test
    fun `golden path - PENDING lyric becomes COMPLETED with merged tokens and translation`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫が寝る"))

        every { geminiClient.translateLyrics(any()) } returns listOf(
            TranslationResult(index = 0, koreanLyrics = "고양이가 잔다", koreanPronounciation = "네코가 네루"),
        )
        every { geminiClient.lookupWordMeanings(any()) } answers {
            // Echo back baseForms supplied in the request so the 1:1 merge can succeed regardless
            // of which morphemes the real ensemble analyzer emits.
            @Suppress("UNCHECKED_CAST")
            val input = firstArg<List<Map<String, Any?>>>()
            input.map { line ->
                val idx = line["index"] as Int
                val words = (line["words"] as List<Map<String, Any?>>).map {
                    WordMeaning(baseForm = it["baseForm"] as String, koreanText = "뜻:${it["baseForm"]}")
                }
                WordMeaningResult(index = idx, words = words)
            }
        }

        val ok = service.translateOne(lyric)

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
        // Every non-symbol token whose surface is Japanese should have a koreanText filled in.
        val japaneseTokens = line.tokens.filter { it.partOfSpeech != PartOfSpeech.SYMBOL }
        assertThat(japaneseTokens).allSatisfy { token ->
            assertThat(token.koreanText).isNotNull
            assertThat(token.koreanText).startsWith("뜻:")
        }
    }

    @Test
    fun `non-japanese tokens are skipped from lookupWordMeanings input and get null koreanText`(): Unit = runBlocking {
        // ASCII bracket is misclassified by Kuromoji but caught by the surface-based skip filter.
        val lyric = seedLyric(listOf("猫[寝"))

        every { geminiClient.translateLyrics(any()) } returns listOf(
            TranslationResult(0, "고양이[잠", "네코[네"),
        )
        every { geminiClient.lookupWordMeanings(any()) } answers {
            @Suppress("UNCHECKED_CAST")
            val input = firstArg<List<Map<String, Any?>>>()
            // None of the forwarded words should be the ASCII bracket.
            val allForwarded = input.flatMap { (it["words"] as List<Map<String, Any?>>).map { w -> w["baseForm"] as String } }
            assertThat(allForwarded).noneMatch { it.contains("[") }
            input.map { line ->
                val words = (line["words"] as List<Map<String, Any?>>).map {
                    WordMeaning(baseForm = it["baseForm"] as String, koreanText = "뜻:${it["baseForm"]}")
                }
                WordMeaningResult(index = line["index"] as Int, words = words)
            }
        }

        service.translateOne(lyric)

        val analyzed = lyricRepository.findById(lyric.id!!).orElseThrow().analyzedContent!!
        val bracketTokens = analyzed[0].tokens.filter { it.surface == "[" }
        assertThat(bracketTokens).isNotEmpty
        assertThat(bracketTokens).allSatisfy { t ->
            // Skippable tokens get force-set to SYMBOL with null koreanText regardless of
            // what the analyzer originally tagged them as.
            assertThat(t.partOfSpeech).isEqualTo(PartOfSpeech.SYMBOL)
            assertThat(t.koreanText).isNull()
        }
    }

    @Test
    fun `failure under MAX_RETRIES bumps retryCount and resets status to PENDING`(): Unit = runBlocking {
        val lyric = seedLyric(listOf("猫"))

        every { geminiClient.translateLyrics(any()) } throws RuntimeException("boom")
        every { geminiClient.lookupWordMeanings(any()) } throws RuntimeException("boom")

        val ok = service.translateOne(lyric)

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
        every { geminiClient.lookupWordMeanings(any()) } throws RuntimeException("permanent failure")

        val ok = service.translateOne(lyric)

        assertThat(ok).isFalse
        val refreshed = lyricRepository.findById(lyric.id!!).orElseThrow()
        assertThat(refreshed.status).isEqualTo(KoreanLyricStatus.FAILED)
        assertThat(refreshed.retryCount).isEqualTo(3)
    }

    @Test
    fun `translation and word meaning calls are made in parallel via coroutineScope`(): Unit = runBlocking {
        // Both calls are issued — we just verify the dispatch (not strict ordering).
        val lyric = seedLyric(listOf("猫"))

        every { geminiClient.translateLyrics(any()) } returns listOf(TranslationResult(0, "고양이", "네코"))
        every { geminiClient.lookupWordMeanings(any()) } answers {
            @Suppress("UNCHECKED_CAST")
            val input = firstArg<List<Map<String, Any?>>>()
            input.map { line ->
                val words = (line["words"] as List<Map<String, Any?>>).map {
                    WordMeaning(baseForm = it["baseForm"] as String, koreanText = "뜻")
                }
                WordMeaningResult(index = line["index"] as Int, words = words)
            }
        }

        service.translateOne(lyric)

        verify(exactly = 1) { geminiClient.translateLyrics(any()) }
        verify(exactly = 1) { geminiClient.lookupWordMeanings(any()) }
    }

    @Test
    fun `processTranslations marks oldest PENDING entries as PROCESSING up to BATCH_SIZE`() {
        // Slow-stub Gemini so the async portion does not race ahead and flip our PROCESSING
        // assertions to COMPLETED before we can read them.
        every { geminiClient.translateLyrics(any()) } answers {
            Thread.sleep(2_000); listOf(TranslationResult(0, "x", "y"))
        }
        every { geminiClient.lookupWordMeanings(any()) } answers {
            Thread.sleep(2_000); emptyList()
        }

        // Seed 7 PENDING entries (BATCH_SIZE = 5, so 2 should remain PENDING).
        val all = (1..7).map { seedLyric(listOf("猫$it")) }

        service.processTranslations()

        // Read each row directly; the polling step has committed in its own transaction.
        val statuses = all.map { lyricRepository.findById(it.id!!).orElseThrow().status }
        val processingCount = statuses.count { it == KoreanLyricStatus.PROCESSING }
        val pendingCount = statuses.count { it == KoreanLyricStatus.PENDING }
        assertThat(processingCount + pendingCount).isEqualTo(7)
        // BATCH_SIZE = 5
        assertThat(processingCount).isEqualTo(5)
        assertThat(pendingCount).isEqualTo(2)

        // Ordering: the oldest 5 (by createdAt asc — same as insertion order here) should be
        // the ones picked up.
        val oldest5Ids = all.take(5).map { it.id!! }.toSet()
        val processingIds = all
            .filter { lyricRepository.findById(it.id!!).orElseThrow().status == KoreanLyricStatus.PROCESSING }
            .map { it.id!! }
            .toSet()
        assertThat(processingIds).isEqualTo(oldest5Ids)
    }

    @Test
    fun `processTranslations is a no-op when there are no PENDING lyrics`() {
        seedLyric(listOf("猫"), status = KoreanLyricStatus.COMPLETED)

        service.processTranslations()

        verify(exactly = 0) { geminiClient.translateLyrics(any()) }
        verify(exactly = 0) { geminiClient.lookupWordMeanings(any()) }
    }
}
