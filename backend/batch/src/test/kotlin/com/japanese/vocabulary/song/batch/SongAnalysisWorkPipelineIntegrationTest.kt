package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.lyricsearch.LyricsResult
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSearchItemDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSearchResponse
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSnippetDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeThumbnailsDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeVideoIdDto
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
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
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
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
            SegLineDto(
                0,
                listOf(
                    SegWordDto(surface = "ももいろ", dictionaryForm = "ももいろ"),
                    SegWordDto(surface = "の", dictionaryForm = "の"),
                    SegWordDto(surface = "鍵", dictionaryForm = "鍵"),
                ),
            ),
        )
        coEvery { jishoService.lookupAll(any()) } returns mapOf(
            "ももいろ" to JishoEntryDto(
                found = true,
                word = "ももいろ",
                options = listOf(JishoOptionDto(reading = "モモイロ", pos = listOf("Noun"), english = "pink", jlpt = emptyList())),
                provenance = JishoLookupProvenance.EXACT,
            ),
            "鍵" to JishoEntryDto(
                found = true,
                word = "鍵",
                options = listOf(JishoOptionDto(reading = "かぎ", pos = listOf("Noun"), english = "key", jlpt = emptyList())),
                provenance = JishoLookupProvenance.EXACT,
            ),
        )
        every { geminiClient.selectSenses(any()) } answers {
            @Suppress("UNCHECKED_CAST")
            firstArg<List<Map<String, Any?>>>().map { line ->
                @Suppress("UNCHECKED_CAST")
                val segments = line["segments"] as List<Map<String, Any?>>
                SelectLineDto(
                    index = line["index"] as Int,
                    words = segments.map { segment ->
                        @Suppress("UNCHECKED_CAST")
                        val senses = segment["senses"] as List<Map<String, Any?>>
                        SelectWordDto(
                            surface = segment["surface"] as String,
                            dictionaryForm = segment["dictionaryForm"] as String,
                            senseId = senses.first()["senseId"] as Int,
                            tokenId = segment["tokenId"] as String,
                        )
                    },
                )
            }
        }
        every { geminiClient.translateSenses(any()) } answers {
            @Suppress("UNCHECKED_CAST")
            firstArg<List<Map<String, Any?>>>().map {
                val senseId = it["senseId"] as Int
                val baseForm = it["baseForm"] as String
                SenseTranslationDto(senseId = senseId, koreanText = if (baseForm == "鍵") "열쇠" else "분홍색")
            }
        }
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
