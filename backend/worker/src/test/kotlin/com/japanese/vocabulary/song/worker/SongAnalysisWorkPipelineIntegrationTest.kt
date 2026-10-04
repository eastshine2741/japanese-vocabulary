package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.lyricsearch.LyricsResult
import com.japanese.vocabulary.messagequeue.SongAnalysisWorkMessage
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSearchItemDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSearchResponse
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSnippetDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeThumbnailsDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeContentDetailsDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeVideoIdDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeVideoItemDto
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
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisStageStatus
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkStageRepository
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import com.japanese.vocabulary.test.WorkerBaseIntegrationTest
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.SenseTranslationDto
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.client.jisho.dto.JishoDictionaryEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpServerErrorException
import kotlin.coroutines.EmptyCoroutineContext

class SongAnalysisWorkPipelineIntegrationTest : WorkerBaseIntegrationTest() {

    @Autowired private lateinit var listener: SongAnalysisWorkListener
    @Autowired private lateinit var stageRepository: SongAnalysisWorkStageRepository
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
        drive(created.workId)
        val refreshedWork = workRepository.findById(created.workId).orElseThrow()
        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.COMPLETED)
        assertThat(refreshedWork.currentStage).isEqualTo(SongAnalysisWorkStage.COMPLETE)
        assertThat(refreshedWork.playerReadyAt).isNotNull
        assertThat(refreshedWork.songId).isNotNull
        assertThat(refreshedWork.lyricId).isNotNull
        assertThat(refreshedWork.completedAt).isNotNull

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
        coVerify(exactly = 1) { geminiClient.translateLyrics(any(), any()) }
        coVerify(exactly = 1) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
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
        drive(created.workId)
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
        coVerify(exactly = 0) { geminiClient.translateLyrics(any(), any()) }
        coVerify(exactly = 0) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
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
        drive(created.workId)
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
        verify(exactly = 1) { utaitedbClient.search(any()) }
        verify(exactly = 0) { youtubeClient.searchVideos(any(), any(), any(), any()) }
        coVerify(exactly = 0) { geminiClient.translateLyrics(any(), any()) }
        coVerify(exactly = 0) { geminiClient.segmentAndLemmatize(any(), any(), any()) }
    }

    @Test
    fun `lyrics fall back to UtaiteDB when lrclib and VocaDB miss`(): Unit = runBlocking {
        stubLyricsMissing()
        every { utaitedbClient.search(any()) } returns LyricsResult(utaitedbId = 38167, lyrics = "ももいろの鍵", isSynced = false)
        stubYoutubeFound()
        stubLyricAnalysis()
        val created = workService.createOrReuse(title = TITLE, artist = ARTIST, durationSeconds = 210)

        drive(created.workId)

        val refreshedWork = workRepository.findById(created.workId).orElseThrow()
        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.COMPLETED)
        val lyric = lyricRepository.findById(refreshedWork.lyricId!!).orElseThrow()
        assertThat(lyric.utaitedbId).isEqualTo(38167)
        assertThat(lyric.vocadbId).isNull()
        assertThat(lyric.lyricType).isEqualTo(LyricType.PLAIN)
    }

    @Test
    fun `analyze lyrics failure fails work without creating the song`(): Unit = runBlocking {
        stubLyricsFound()
        stubYoutubeFound()
        stubLyricAnalysisFailure()
        val created = workService.createOrReuse(
            title = TITLE,
            artist = ARTIST,
            durationSeconds = 210,
            triggerSource = SongAnalysisTriggerSource.USER_APP,
        )
        drive(created.workId)
        val refreshedWork = workRepository.findById(created.workId).orElseThrow()
        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.FAILED)
        assertThat(refreshedWork.currentStage).isEqualTo(SongAnalysisWorkStage.ANALYZE_LYRICS)
        assertThat(refreshedWork.playerReadyAt).isNull()
        assertThat(refreshedWork.songId).isNull()
        assertThat(refreshedWork.lyricId).isNull()
        assertThat(refreshedWork.errorCode).isEqualTo("SONG_ANALYSIS_WORK_FAILED")
        assertThat(songRepository.findByArtistAndTitle(ARTIST, TITLE)).isNull()

        verify(exactly = 1) { lrclibClient.search(any()) }
        verify(exactly = 1) { youtubeClient.searchVideos(any(), any(), any(), any()) }
        coVerify(exactly = 1) { geminiClient.translateLyrics(any(), any()) }
        coVerify(exactly = 0) { jevClient.choose(any(), any(), any(), any()) }
        coVerify(exactly = 0) { geminiClient.translateSenses(any(), any()) }
    }

    @Test
    fun `admin reanalysis creates fresh lyric and switches active lyric and mv only on completion`(): Unit = runBlocking {
        stubLyricsFound()
        stubYoutubeFound()
        stubLyricAnalysis()
        val song = persistSongWithOldMv()
        val oldLyric = persistActiveLyric(song.id!!, "古い歌詞")
        val work = persistAdminWork(song.id!!, status = SongAnalysisWorkStatus.PENDING)
        drive(work.id!!)
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
    fun `failed admin reanalysis keeps old active lyric and mv without a candidate lyric`(): Unit = runBlocking {
        stubLyricsFound()
        stubYoutubeFound()
        stubLyricAnalysisFailure()
        val song = persistSongWithOldMv()
        val oldLyric = persistActiveLyric(song.id!!, "古い歌詞")
        val work = persistAdminWork(song.id!!, status = SongAnalysisWorkStatus.PENDING)
        drive(work.id!!)
        entityManager.flush()
        entityManager.clear()

        val refreshedWork = workRepository.findById(work.id!!).orElseThrow()
        val refreshedSong = songRepository.findById(song.id!!).orElseThrow()
        val lyrics = lyricRepository.findAllBySongIdOrderByCreatedAtDesc(song.id!!)

        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.FAILED)
        assertThat(refreshedWork.lyricId).isNull()
        assertThat(refreshedSong.activeLyricId).isEqualTo(oldLyric.id)
        assertThat(refreshedSong.youtubeUrl).isEqualTo("https://youtu.be/old-mv")
        assertThat(lyrics.map { it.id }).containsExactly(oldLyric.id)
    }

    /** 이전 파이프라인에서 곡만 만들어지고 분석이 실패한 곡. 다시 요청하면 새 가사로 분석을 채운다. */
    @Test
    fun `a new request for a song left unanalyzed gives it a fresh analyzed active lyric`(): Unit = runBlocking {
        stubLyricsFound()
        stubYoutubeFound()
        stubLyricAnalysis()
        val song = persistSongWithOldMv()
        val staleLyric = persistActiveLyric(song.id!!, "古い歌詞")
        val created = workService.createOrReuse(title = TITLE, artist = ARTIST, durationSeconds = 210)

        drive(created.workId)

        val refreshedWork = workRepository.findById(created.workId).orElseThrow()
        val refreshedSong = songRepository.findById(song.id!!).orElseThrow()
        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.COMPLETED)
        assertThat(refreshedWork.songId).isEqualTo(song.id)
        assertThat(refreshedWork.lyricId).isNotEqualTo(staleLyric.id)
        assertThat(refreshedSong.activeLyricId).isEqualTo(refreshedWork.lyricId)
        assertThat(refreshedSong.youtubeUrl).isEqualTo("https://youtu.be/old-mv")
        val lyric = lyricRepository.findById(refreshedWork.lyricId!!).orElseThrow()
        assertThat(lyric.rawContent.map { it.text }).containsExactly("ももいろの鍵")
        assertThat(lyric.analyzedContent!![0].koreanLyrics).isEqualTo("복숭아빛 열쇠")
    }

    /** 배포 전에 CREATE_SONG_AND_LYRIC 을 기다리던 작업은 그 단계에서 곡을 만들고 그 가사로 끝난다. */
    @Test
    fun `work waiting for the old create stage still finishes on the lyric it created`(): Unit = runBlocking {
        stubLyricsFound()
        stubYoutubeFound()
        stubLyricAnalysis()
        val created = workService.createOrReuse(title = TITLE, artist = ARTIST, durationSeconds = 210)
        deliver(created.workId, SongAnalysisWorkStage.FETCH_LYRICS)
        deliver(created.workId, SongAnalysisWorkStage.FETCH_YOUTUBE)
        val waiting = workRepository.findById(created.workId).orElseThrow()
        waiting.currentStage = SongAnalysisWorkStage.CREATE_SONG_AND_LYRIC
        workRepository.saveAndFlush(waiting)

        deliver(created.workId, SongAnalysisWorkStage.CREATE_SONG_AND_LYRIC)
        val songId = workRepository.findById(created.workId).orElseThrow().songId!!
        val legacyLyricId = workRepository.findById(created.workId).orElseThrow().lyricId!!
        drive(created.workId)

        val refreshedWork = workRepository.findById(created.workId).orElseThrow()
        assertThat(refreshedWork.status).isEqualTo(SongAnalysisWorkStatus.COMPLETED)
        assertThat(refreshedWork.lyricId).isEqualTo(legacyLyricId)
        assertThat(songRepository.findById(songId).orElseThrow().activeLyricId).isEqualTo(legacyLyricId)
        assertThat(lyricRepository.findAllBySongIdOrderByCreatedAtDesc(songId)).hasSize(1)
        assertThat(lyricRepository.findById(legacyLyricId).orElseThrow().analyzedContent).hasSize(1)
    }

    /**
     * 실패한 단계부터 이어서 돌린다. 앞 단계(가사·MV 검색)는 다시 하지 않고, 가사 분석
     * 단계 안에서도 이미 끝난 번역 갈래는 다시 부르지 않는다.
     */
    @Test
    fun `resume reruns only the failed stage and keeps finished branches`(): Unit = runBlocking {
        stubLyricsFound()
        stubYoutubeFound()
        stubLyricAnalysis()
        coEvery { geminiClient.segmentAndLemmatize(any(), any(), any()) } throws RuntimeException("segmentation broke")
        val created = workService.createOrReuse(title = TITLE, artist = ARTIST, durationSeconds = 210)

        drive(created.workId)

        val failed = workRepository.findById(created.workId).orElseThrow()
        assertThat(failed.status).isEqualTo(SongAnalysisWorkStatus.FAILED)
        assertThat(failed.currentStage).isEqualTo(SongAnalysisWorkStage.ANALYZE_LYRICS)
        val failedStage = stage(created.workId, SongAnalysisWorkStage.ANALYZE_LYRICS)
        assertThat(failedStage.status).isEqualTo(SongAnalysisStageStatus.FAILED)
        assertThat(failedStage.errorClass).isEqualTo("java.lang.RuntimeException")
        assertThat(failedStage.errorMessage).contains("segmentation broke")
        assertThat(failedStage.output).contains("복숭아빛 열쇠")
        assertThat(stage(created.workId, SongAnalysisWorkStage.FETCH_LYRICS).status).isEqualTo(SongAnalysisStageStatus.COMPLETED)

        stubLyricAnalysis()
        workService.resume(created.workId)
        drive(created.workId)

        val resumed = workRepository.findById(created.workId).orElseThrow()
        assertThat(resumed.status).isEqualTo(SongAnalysisWorkStatus.COMPLETED)
        assertThat(stage(created.workId, SongAnalysisWorkStage.ANALYZE_LYRICS).attempt).isEqualTo(2)
        assertThat(lyricRepository.findById(resumed.lyricId!!).orElseThrow().analyzedContent!![0].koreanLyrics)
            .isEqualTo("복숭아빛 열쇠")
        verify(exactly = 1) { lrclibClient.search(any()) }
        verify(exactly = 1) { youtubeClient.searchVideos(any(), any(), any(), any()) }
        coVerify(exactly = 1) { geminiClient.translateLyrics(any(), any()) }
        assertThat(songRepository.findByArtistAndTitle(ARTIST, TITLE)!!.id).isEqualTo(resumed.songId)
    }

    /** 공급자가 끝내 답하지 못한 것은 "가사 없음" 이 아니다. 재시도한 뒤 장애로 기록한다. */
    @Test
    fun `lyric provider outage is retried and reported as an outage, not a miss`(): Unit = runBlocking {
        stubLyricsFound()
        every { lrclibClient.search(any()) } throws HttpServerErrorException(HttpStatus.SERVICE_UNAVAILABLE)
        val created = workService.createOrReuse(title = TITLE, artist = ARTIST, durationSeconds = 210)

        drive(created.workId)

        val refreshed = workRepository.findById(created.workId).orElseThrow()
        assertThat(refreshed.status).isEqualTo(SongAnalysisWorkStatus.FAILED)
        assertThat(refreshed.currentStage).isEqualTo(SongAnalysisWorkStage.FETCH_LYRICS)
        assertThat(refreshed.errorCode).isEqualTo("SONG_ANALYSIS_PROVIDER_UNAVAILABLE")
        verify(exactly = 3) { lrclibClient.search(any()) }
        verify(exactly = 1) { vocadbClient.search(any()) }
    }

    @Test
    fun `a stage message that is not the one the work waits for is ignored`(): Unit = runBlocking {
        stubLyricsFound()
        val created = workService.createOrReuse(title = TITLE, artist = ARTIST, durationSeconds = 210)

        listener.handle(
            SongAnalysisWorkMessage(created.workId, SongAnalysisWorkStage.SELECT_SENSES),
            redelivered = false,
            EmptyCoroutineContext,
        )

        val refreshed = workRepository.findById(created.workId).orElseThrow()
        assertThat(refreshed.status).isEqualTo(SongAnalysisWorkStatus.PENDING)
        assertThat(stageRepository.findByWorkIdOrderByIdAsc(created.workId)).isEmpty()
        verify(exactly = 0) { lrclibClient.search(any()) }
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
            status = status,
            songId = songId,
            triggerSource = SongAnalysisTriggerSource.ADMIN,
        )
        entityManager.persist(work)
        entityManager.flush()
        return work
    }

    /**
     * 큐 대신 원장이 기다리는 단계를 차례로 배달한다. 리스너는 테스트 스레드에서 돌린다 — 테스트
     * 트랜잭션의 데이터를 보려면 같은 스레드여야 한다.
     */
    private fun drive(workId: Long) {
        repeat(SongAnalysisWorkStage.entries.size + 1) {
            val work = workRepository.findById(workId).orElseThrow()
            if (work.status == SongAnalysisWorkStatus.COMPLETED || work.status == SongAnalysisWorkStatus.FAILED) return
            listener.handle(SongAnalysisWorkMessage(workId, work.currentStage), redelivered = false, EmptyCoroutineContext)
        }
        error("work $workId did not reach a terminal state")
    }

    private fun deliver(workId: Long, stage: SongAnalysisWorkStage) =
        listener.handle(SongAnalysisWorkMessage(workId, stage), redelivered = false, EmptyCoroutineContext)

    private fun stage(workId: Long, stage: SongAnalysisWorkStage) =
        checkNotNull(stageRepository.findByWorkIdAndStage(workId, stage)) { "no $stage row for work $workId" }

    private fun stubLyricsFound() {
        every { lrclibClient.providerName } returns "LrcLib"
        every { vocadbClient.providerName } returns "VocaDB"
        every { utaitedbClient.providerName } returns "UtaiteDB"
        every { lrclibClient.search(any()) } returns LyricsResult(
            lrclibId = 12345,
            lyrics = "[00:12.34]ももいろの鍵",
            isSynced = true,
        )
        every { vocadbClient.search(any()) } returns null
        every { utaitedbClient.search(any()) } returns null
    }

    private fun stubLyricsMissing() {
        every { lrclibClient.providerName } returns "LrcLib"
        every { vocadbClient.providerName } returns "VocaDB"
        every { utaitedbClient.providerName } returns "UtaiteDB"
        every { lrclibClient.search(any()) } returns null
        every { vocadbClient.search(any()) } returns null
        every { utaitedbClient.search(any()) } returns null
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
        every { youtubeClient.listVideoContentDetails(any()) } returns listOf(
            YoutubeVideoItemDto(
                id = "official-video-id",
                contentDetails = YoutubeContentDetailsDto(duration = "PT4M13S"),
            ),
        )
    }

    private fun stubLyricAnalysis() {
        coEvery { geminiClient.translateLyrics(any(), any()) } returns listOf(
            TranslationResultDto(0, "복숭아빛 열쇠"),
        )
        coEvery { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(
                0,
                listOf(
                    segWord("ももいろ", "モモイロ"),
                    segWord("の", "ノ"),
                    segWord("鍵", "カギ"),
                ),
            ),
        )
        coEvery { jishoService.lookupAll(any()) } returns mapOf(
            "ももいろ" to exactEntry("ももいろ", "モモイロ", "pink"),
            "鍵" to exactEntry("鍵", "カギ", "key"),
        )
        stubJevPicksFirstOffered()
        coEvery { geminiClient.translateSenses(any(), any()) } answers {
            @Suppress("UNCHECKED_CAST")
            firstArg<List<Map<String, Any?>>>().map {
                val senseId = it["senseId"] as Int
                val baseForm = it["baseForm"] as String
                SenseTranslationDto(senseId = senseId, koreanText = if (baseForm == "鍵") "열쇠" else "분홍색")
            }
        }
    }

    private fun segWord(surface: String, reading: String) =
        SegWordDto(
            surface = surface,
            headword = surface,
            usedReading = reading,
            baseFormReading = reading,
            contextGloss = "gloss",
        )

    private fun exactEntry(word: String, reading: String, english: String) = JishoEntryDto(
        found = true,
        word = word,
        entries = listOf(
            JishoDictionaryEntryDto(
                headword = word,
                reading = reading,
                senses = listOf(JishoOptionDto(pos = listOf("Noun"), english = english, englishDefinitions = listOf(english))),
            ),
        ),
        provenance = JishoLookupProvenance.EXACT,
    )

    private fun stubLyricAnalysisFailure() {
        coEvery { geminiClient.translateLyrics(any(), any()) } throws RuntimeException("Gemini unavailable")
        coEvery { geminiClient.segmentAndLemmatize(any(), any(), any()) } returns listOf(
            SegLineDto(0, listOf(segWord("ももいろ", "モモイロ"))),
        )
        coEvery { jishoService.lookupAll(any()) } returns emptyMap()
    }

    private companion object {
        const val TITLE = "ももいろの鍵"
        const val ARTIST = "いよわ"
    }
}
