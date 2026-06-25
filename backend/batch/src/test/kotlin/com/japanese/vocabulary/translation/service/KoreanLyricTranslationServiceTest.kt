package com.japanese.vocabulary.translation.service

import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.SenseTranslationDto
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
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
                JishoEntryDto(true, df, listOf(JishoOptionDto("ヨミ", listOf("Noun"), "x", listOf("jlpt-n5"))))
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
