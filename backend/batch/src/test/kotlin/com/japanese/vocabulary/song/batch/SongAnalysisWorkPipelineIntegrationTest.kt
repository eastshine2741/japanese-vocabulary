package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.lyricsearch.LyricsResult
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSearchItemDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSearchResponse
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSnippetDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeThumbnailsDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeVideoIdDto
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.SenseTranslationDto
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import io.mockk.coEvery
import io.mockk.every
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.time.Duration
import java.time.Instant

class SongAnalysisWorkPipelineIntegrationTest : BatchBaseIntegrationTest() {

    @Autowired private lateinit var processor: SongAnalysisWorkProcessor
    @Autowired private lateinit var workService: SongAnalysisWorkService
    @Autowired private lateinit var workRepository: SongAnalysisWorkRepository
    @Autowired private lateinit var songRepository: SongRepository
    @Autowired private lateinit var lyricRepository: LyricRepository

    @Test
    fun `full song analysis work pipeline creates player-ready song with youtube url and analyzed lyrics`(): Unit = runBlocking {
        stubLyricsFound()
        stubYoutubeFound()
        stubLyricAnalysis()
        val created = workService.createOrReuse(
            title = TITLE,
            artist = ARTIST,
            durationSeconds = 210,
            artworkUrl = "https://img.example/momoiro.jpg",
            triggerSource = SongAnalysisTriggerSource.USER_APP,
        )
        val work = claimSingleWork(created.workId)

        val processed = processor.process(work)

        assertThat(processed).isTrue
        val refreshedWork = workRepository.findById(created.workId).orElseThrow()
        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.COMPLETED)
        assertThat(refreshedWork.currentStage).isEqualTo(SongAnalysisWorkStage.ANALYZE_LYRICS)
        assertThat(refreshedWork.playerReadyAt).isNotNull
        assertThat(refreshedWork.songId).isNotNull
        assertThat(refreshedWork.lyricId).isNotNull
        assertThat(refreshedWork.completedAt).isNotNull
        assertThat(refreshedWork.activeDedupKey).isNull()

        val song = songRepository.findById(refreshedWork.songId!!).orElseThrow()
        assertThat(song.title).isEqualTo(TITLE)
        assertThat(song.artist).isEqualTo(ARTIST)
        assertThat(song.youtubeUrl).isEqualTo("https://www.youtube.com/watch?v=official-video-id")
        assertThat(song.artworkUrl).isEqualTo("https://img.example/momoiro.jpg")

        val lyric = lyricRepository.findById(refreshedWork.lyricId!!).orElseThrow()
        assertThat(lyric.songId).isEqualTo(song.id)
        assertThat(lyric.lyricType).isEqualTo(LyricType.SYNCED)
        assertThat(lyric.rawContent.map { it.text }).containsExactly("ももいろの鍵")
        assertThat(lyric.rawContent[0].startTimeMs).isEqualTo(12340)
        assertThat(lyric.analyzedContent).hasSize(1)
        assertThat(lyric.analyzedContent!![0].koreanLyrics).isEqualTo("복숭아빛 열쇠")
        assertThat(lyric.analyzedContent!![0].tokens).isNotEmpty

        verify(exactly = 1) { lrclibClient.search(any()) }
        verify(exactly = 0) { vocadbClient.search(any()) }
        verify(exactly = 1) { youtubeClient.searchVideos(any(), any(), any(), any()) }
        verify(exactly = 1) { geminiClient.translateLyrics(any()) }
        verify(exactly = 1) { geminiClient.segmentAndLemmatize(any()) }
    }

    @Test
    fun `youtube search failure fails work without player-ready milestone or song row`(): Unit = runBlocking {
        stubLyricsFound()
        every {
            youtubeClient.searchVideos(query = any(), pageToken = any(), maxResults = any(), videoCategoryId = any())
        } throws RuntimeException("403 Forbidden: unregistered callers must use API Key")
        stubLyricAnalysis()
        val created = workService.createOrReuse(
            title = TITLE,
            artist = ARTIST,
            durationSeconds = 210,
            triggerSource = SongAnalysisTriggerSource.USER_APP,
        )
        val work = claimSingleWork(created.workId)

        val processed = processor.process(work)

        assertThat(processed).isFalse
        val refreshedWork = workRepository.findById(created.workId).orElseThrow()
        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.FAILED)
        assertThat(refreshedWork.currentStage).isEqualTo(SongAnalysisWorkStage.FETCH_YOUTUBE)
        assertThat(refreshedWork.playerReadyAt).isNull()
        assertThat(refreshedWork.songId).isNull()
        assertThat(refreshedWork.lyricId).isNull()
        assertThat(refreshedWork.errorCode).isEqualTo("SONG_ANALYSIS_WORK_FAILED")
        assertThat(songRepository.findByArtistAndTitle(ARTIST, TITLE)).isNull()

        verify(exactly = 1) { lrclibClient.search(any()) }
        verify(exactly = 1) { youtubeClient.searchVideos(any(), any(), any(), any()) }
        verify(exactly = 0) { geminiClient.translateLyrics(any()) }
        verify(exactly = 0) { geminiClient.segmentAndLemmatize(any()) }
    }

    @Test
    fun `lyric lookup failure fails work without youtube search or player-ready milestone`(): Unit = runBlocking {
        stubLyricsMissing()
        stubYoutubeFound()
        stubLyricAnalysis()
        val created = workService.createOrReuse(
            title = TITLE,
            artist = ARTIST,
            durationSeconds = 210,
            triggerSource = SongAnalysisTriggerSource.USER_APP,
        )
        val work = claimSingleWork(created.workId)

        val processed = processor.process(work)

        assertThat(processed).isFalse
        val refreshedWork = workRepository.findById(created.workId).orElseThrow()
        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.FAILED)
        assertThat(refreshedWork.currentStage).isEqualTo(SongAnalysisWorkStage.FETCH_LYRICS)
        assertThat(refreshedWork.playerReadyAt).isNull()
        assertThat(refreshedWork.songId).isNull()
        assertThat(refreshedWork.lyricId).isNull()
        assertThat(refreshedWork.errorCode).isEqualTo("LYRICS_NOT_FOUND")
        assertThat(songRepository.findByArtistAndTitle(ARTIST, TITLE)).isNull()

        verify(exactly = 1) { lrclibClient.search(any()) }
        verify(exactly = 1) { vocadbClient.search(any()) }
        verify(exactly = 0) { youtubeClient.searchVideos(any(), any(), any(), any()) }
        verify(exactly = 0) { geminiClient.translateLyrics(any()) }
        verify(exactly = 0) { geminiClient.segmentAndLemmatize(any()) }
    }

    @Test
    fun `analyze lyrics failure fails work after player-ready milestone without analyzed content`(): Unit = runBlocking {
        stubLyricsFound()
        stubYoutubeFound()
        stubLyricAnalysisFailure()
        val created = workService.createOrReuse(
            title = TITLE,
            artist = ARTIST,
            durationSeconds = 210,
            triggerSource = SongAnalysisTriggerSource.USER_APP,
        )
        val work = claimSingleWork(created.workId)

        val processed = processor.process(work)

        assertThat(processed).isFalse
        val refreshedWork = workRepository.findById(created.workId).orElseThrow()
        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.FAILED)
        assertThat(refreshedWork.currentStage).isEqualTo(SongAnalysisWorkStage.ANALYZE_LYRICS)
        assertThat(refreshedWork.playerReadyAt).isNotNull
        assertThat(refreshedWork.songId).isNotNull
        assertThat(refreshedWork.lyricId).isNotNull
        assertThat(refreshedWork.errorCode).isEqualTo("SONG_ANALYSIS_WORK_FAILED")

        val song = songRepository.findById(refreshedWork.songId!!).orElseThrow()
        assertThat(song.youtubeUrl).isEqualTo("https://www.youtube.com/watch?v=official-video-id")
        val lyric = lyricRepository.findById(refreshedWork.lyricId!!).orElseThrow()
        assertThat(lyric.analyzedContent).isNull()

        verify(exactly = 1) { lrclibClient.search(any()) }
        verify(exactly = 1) { youtubeClient.searchVideos(any(), any(), any(), any()) }
        verify(exactly = 1) { geminiClient.translateLyrics(any()) }
        verify(exactly = 0) { geminiClient.selectSenses(any()) }
        verify(exactly = 0) { geminiClient.translateSenses(any()) }
    }

    @Test
    fun `admin reanalysis creates fresh lyric and switches active lyric and mv only on completion`(): Unit = runBlocking {
        stubLyricsFound()
        stubYoutubeFound()
        stubLyricAnalysis()
        val song = persistSongWithOldMv()
        val oldLyric = persistActiveLyric(song.id!!, "古い歌詞")
        val work = persistAdminWork(song.id!!, status = SongAnalysisWorkStatus.PENDING)
        val claimed = claimSingleWork(work.id!!)

        val processed = processor.process(claimed)

        assertThat(processed).isTrue
        entityManager.flush()
        entityManager.clear()

        val refreshedWork = workRepository.findById(work.id!!).orElseThrow()
        val refreshedSong = songRepository.findById(song.id!!).orElseThrow()
        val lyrics = lyricRepository.findAllBySongIdOrderByCreatedAtDesc(song.id!!)

        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.COMPLETED)
        assertThat(refreshedWork.youtubeUrl).isEqualTo("https://www.youtube.com/watch?v=official-video-id")
        assertThat(refreshedWork.lyricId).isNotEqualTo(oldLyric.id)
        assertThat(refreshedSong.activeLyricId).isEqualTo(refreshedWork.lyricId)
        assertThat(refreshedSong.youtubeUrl).isEqualTo("https://www.youtube.com/watch?v=official-video-id")
        assertThat(lyrics.map { it.id }).contains(oldLyric.id, refreshedWork.lyricId)
        assertThat(lyricRepository.findById(oldLyric.id!!).orElseThrow().rawContent.single().text).isEqualTo("古い歌詞")
    }

    @Test
    fun `failed admin reanalysis keeps old active lyric and mv while retaining inactive candidate lyric`(): Unit = runBlocking {
        stubLyricsFound()
        stubYoutubeFound()
        stubLyricAnalysisFailure()
        val song = persistSongWithOldMv()
        val oldLyric = persistActiveLyric(song.id!!, "古い歌詞")
        val work = persistAdminWork(song.id!!, status = SongAnalysisWorkStatus.PENDING)
        val claimed = claimSingleWork(work.id!!)

        val processed = processor.process(claimed)

        assertThat(processed).isFalse
        entityManager.flush()
        entityManager.clear()

        val refreshedWork = workRepository.findById(work.id!!).orElseThrow()
        val refreshedSong = songRepository.findById(song.id!!).orElseThrow()
        val lyrics = lyricRepository.findAllBySongIdOrderByCreatedAtDesc(song.id!!)

        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.FAILED)
        assertThat(refreshedWork.youtubeUrl).isEqualTo("https://www.youtube.com/watch?v=official-video-id")
        assertThat(refreshedWork.lyricId).isNotNull
        assertThat(refreshedWork.lyricId).isNotEqualTo(oldLyric.id)
        assertThat(refreshedSong.activeLyricId).isEqualTo(oldLyric.id)
        assertThat(refreshedSong.youtubeUrl).isEqualTo("https://youtu.be/old-mv")
        assertThat(lyrics.map { it.id }).contains(oldLyric.id, refreshedWork.lyricId)
    }

    private fun persistActiveLyric(songId: Long, text: String): LyricEntity {
        val lyric = LyricEntity(
            songId = songId,
            lyricType = LyricType.PLAIN,
            rawContent = listOf(LyricLineData(index = 0, startTimeMs = 0, text = text)),
        )
        entityManager.persist(lyric)
        entityManager.flush()
        val song = songRepository.findById(songId).orElseThrow()
        song.activeLyricId = lyric.id
        songRepository.saveAndFlush(song)
        return lyric
    }

    private fun persistSongWithOldMv(): SongEntity {
        val song = SongEntity(
            title = TITLE,
            artist = ARTIST,
            durationSeconds = 210,
            youtubeUrl = "https://youtu.be/old-mv",
        )
        entityManager.persist(song)
        entityManager.flush()
        return song
    }

    private fun persistAdminWork(songId: Long, status: SongAnalysisWorkStatus): SongAnalysisWorkEntity {
        val work = SongAnalysisWorkEntity(
            rawTitle = TITLE,
            rawArtist = ARTIST,
            activeDedupKey = SongAnalysisWorkService.buildAdminReanalysisDedupKey(songId),
            status = status,
            songId = songId,
            triggerSource = SongAnalysisTriggerSource.ADMIN,
        )
        entityManager.persist(work)
        entityManager.flush()
        return work
    }

    private fun claimSingleWork(workId: Long) =
        workService.claimPending(
            limit = 1,
            workerId = "pipeline-test-worker",
            lockUntil = Instant.now().plus(Duration.ofMinutes(30)),
        ).single { it.id == workId }

    private fun stubLyricsFound() {
        every { lrclibClient.providerName } returns "LrcLib"
        every { vocadbClient.providerName } returns "VocaDB"
        every { lrclibClient.search(any()) } returns LyricsResult(
            lrclibId = 12345,
            lyrics = "[00:12.34]ももいろの鍵",
            isSynced = true,
        )
        every { vocadbClient.search(any()) } returns null
    }

    private fun stubLyricsMissing() {
        every { lrclibClient.providerName } returns "LrcLib"
        every { vocadbClient.providerName } returns "VocaDB"
        every { lrclibClient.search(any()) } returns null
        every { vocadbClient.search(any()) } returns null
    }

    private fun stubYoutubeFound() {
        every {
            youtubeClient.searchVideos(query = any(), pageToken = any(), maxResults = any(), videoCategoryId = any())
        } returns YoutubeSearchResponse(
            nextPageToken = null,
            items = listOf(
                YoutubeSearchItemDto(
                    id = YoutubeVideoIdDto(videoId = "official-video-id"),
                    snippet = YoutubeSnippetDto(
                        title = "$TITLE Official MV",
                        thumbnails = YoutubeThumbnailsDto(medium = null, default = null),
                        channelTitle = ARTIST,
                        channelId = null,
                    ),
                ),
            ),
        )
    }

    private fun stubLyricAnalysis() {
        every { geminiClient.translateLyrics(any()) } returns listOf(
            TranslationResultDto(0, "복숭아빛 열쇠", "모모이로노 카기"),
        )
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto(surface = "ももいろ", dictionaryForm = "ももいろ"))),
        )
        coEvery { jishoService.lookupAll(any()) } returns mapOf(
            "ももいろ" to JishoEntryDto(
                found = true,
                word = "ももいろ",
                options = listOf(JishoOptionDto(reading = "モモイロ", pos = listOf("Noun"), english = "pink", jlpt = emptyList())),
            ),
        )
        every { geminiClient.selectSenses(any()) } returns listOf(
            SelectLineDto(0, listOf(SelectWordDto(surface = "ももいろ", dictionaryForm = "ももいろ", senseId = 0))),
        )
        every { geminiClient.translateSenses(any()) } returns listOf(
            SenseTranslationDto(senseId = 0, koreanText = "분홍색"),
        )
    }

    private fun stubLyricAnalysisFailure() {
        every { geminiClient.translateLyrics(any()) } throws RuntimeException("Gemini unavailable")
        every { geminiClient.segmentAndLemmatize(any()) } returns listOf(
            SegLineDto(0, listOf(SegWordDto(surface = "ももいろ", dictionaryForm = "ももいろ"))),
        )
        coEvery { jishoService.lookupAll(any()) } returns emptyMap()
    }

    private companion object {
        const val TITLE = "ももいろの鍵"
        const val ARTIST = "いよわ"
    }
}
