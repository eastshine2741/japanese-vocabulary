package com.japanese.vocabulary.admin

import com.japanese.vocabulary.admin.dto.reels.AdminReelsRenderRequest
import com.japanese.vocabulary.admin.reels.AdminReelsRenderFailedException
import com.japanese.vocabulary.admin.reels.AdminReelsRenderService
import com.japanese.vocabulary.admin.reels.AdminReelsSourceCache
import com.japanese.vocabulary.admin.reels.model.AdminReelsRenderInput
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import java.nio.file.Files
import java.nio.file.Path

@AutoConfigureMockMvc
@Import(AdminReelsFactoryControllerTest.ReelsFactoryTestConfig::class)
class AdminReelsFactoryControllerTest : AdminBaseIntegrationTest() {
    @Autowired private lateinit var fakeRenderer: FakeReelsRenderService
    @Autowired private lateinit var fakeSourceCache: FakeReelsSourceCache

    @Test
    fun `reels factory lists candidates and exposes analyzed timed lines`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("Lemon")
            .withArtist("米津玄師")
            .withYoutubeUrl("https://youtu.be/SX_ViT4Ra7k")
            .build()
        persistLyric(song.id!!, analyzed = true, lineCount = 4)

        mockMvc.get("/admin/api/reels-factory/songs") {
            header("Authorization", "Bearer ${adminToken()}")
            param("q", "lem")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].title") { value("Lemon") }
            jsonPath("$.content[0].hasAnalyzedLyrics") { value(true) }
            jsonPath("$.content[0].renderEligible") { value(true) }
        }

        mockMvc.get("/admin/api/reels-factory/songs/${song.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.song.artist") { value("米津玄師") }
            jsonPath("$.lines[0].originalText") { value("歌詞0") }
            jsonPath("$.lines[0].recommendedVocabulary[0].japanese") { value("夢") }
            jsonPath("$.lines[0].recommendedVocabulary[0].partOfSpeechLabel") { value("명사") }
            jsonPath("$.lines[0].recommendedVocabulary[0].jlpt") { value("N5") }
            jsonPath("$.minLineCount") { value(4) }
            jsonPath("$.maxLineCount") { doesNotExist() }
        }
    }

    @Test
    fun `reels factory render validates acknowledgement and returns mp4 from renderer`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("Lemon")
            .withArtist("米津玄師")
            .withYoutubeUrl("https://youtu.be/SX_ViT4Ra7k")
            .build()
        persistLyric(song.id!!, analyzed = true, lineCount = 7)
        val token = adminToken()

        mockMvc.post("/admin/api/reels-factory/render") {
            header("Authorization", "Bearer $token")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                AdminReelsRenderRequest(
                    songId = song.id!!,
                    lineIndexes = listOf(0, 1, 2, 3),
                    acknowledgeSourceRightsAndPlatformRisk = false,
                ),
            )
        }.andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("bad_request") }
        }

        mockMvc.post("/admin/api/reels-factory/render") {
            header("Authorization", "Bearer $token")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                AdminReelsRenderRequest(
                    songId = song.id!!,
                    // 어드민이 고른 순서와 무관하게 곡 순서로 튼다
                    lineIndexes = listOf(4, 2, 1, 3, 5),
                    acknowledgeSourceRightsAndPlatformRisk = true,
                ),
            )
        }.andExpect {
            status { isOk() }
            header { string("Content-Type", "video/mp4") }
            header { string("Content-Disposition", "attachment; filename=\"kotonoha-reel-${song.id}.mp4\"") }
        }

        assertThat(fakeRenderer.lastInput?.source?.youtubeUrl).isEqualTo("https://youtu.be/SX_ViT4Ra7k")
        // 미리보기 캐시가 받아 둔 source 를 렌더 스크립트에 그대로 넘긴다
        assertThat(fakeRenderer.lastInput?.source?.localPath)
            .isEqualTo(fakeSourceCache.cached("https://youtu.be/SX_ViT4Ra7k").toString())
        val data = requireNotNull(fakeRenderer.lastInput?.data)
        assertThat(data.lyricLines).hasSize(5)
        assertThat(data.lyricLines.map { it.lineNumber }).containsExactly(2, 3, 4, 5, 6)
        // 줄 간격 2초 = 60프레임. 첫 선택 줄(index 1, 2초)이 0프레임이다
        assertThat(data.sourceStartFrame).isEqualTo(60)
        assertThat(data.lyricLines.map { it.startFrame }).containsExactly(0, 60, 120, 180, 240)
        // 마지막 선택 줄(index 5) 다음 줄(index 6, 12초)이 시작할 때 가사가 끝난다
        assertThat(data.lyricsEndFrame).isEqualTo(300)
        assertThat(data.totalLineCount).isEqualTo(7)
        assertThat(data.wordCount).isEqualTo(1)
        assertThat(fakeRenderer.lastInput?.data?.lyricLines?.first()?.tokens?.first()?.reading).isEqualTo("ユメ")
        assertThat(fakeRenderer.lastInput?.data?.lyricLines?.first()?.vocabulary?.first()?.partOfSpeechLabel).isEqualTo("명사")
    }

    @Test
    fun `reels factory render failure returns json for mp4 accept header`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("Lemon")
            .withArtist("米津玄師")
            .withYoutubeUrl("https://youtu.be/SX_ViT4Ra7k")
            .build()
        persistLyric(song.id!!, analyzed = true, lineCount = 4)
        fakeRenderer.failWith = AdminReelsRenderFailedException("boom")

        mockMvc.post("/admin/api/reels-factory/render") {
            header("Authorization", "Bearer ${adminToken()}")
            accept(MediaType.parseMediaType("video/mp4"))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                AdminReelsRenderRequest(
                    songId = song.id!!,
                    lineIndexes = listOf(0, 1, 2, 3),
                    acknowledgeSourceRightsAndPlatformRisk = true,
                ),
            )
        }.andExpect {
            status { isInternalServerError() }
            content { contentType(MediaType.APPLICATION_JSON) }
            jsonPath("$.error") { value("render_failed") }
        }
    }

    @Test
    fun `reels factory render rejects missing analyzed lyrics youtube url duplicate lines and missing timing`() {
        val noAnalysisSong = TestSongBuilder(entityManager).withYoutubeUrl("https://youtu.be/no-analysis").build()
        persistLyric(noAnalysisSong.id!!, analyzed = false, lineCount = 4)
        val noYoutubeSong = TestSongBuilder(entityManager).withYoutubeUrl(null).build()
        persistLyric(noYoutubeSong.id!!, analyzed = true, lineCount = 4)
        val missingTimingSong = TestSongBuilder(entityManager).withYoutubeUrl("https://youtu.be/no-time").build()
        persistLyric(missingTimingSong.id!!, analyzed = true, lineCount = 4, missingTimingIndex = 2)
        val token = adminToken()

        renderExpectingBadRequest(token, noAnalysisSong.id!!, listOf(0, 1, 2, 3))
        renderExpectingBadRequest(token, noYoutubeSong.id!!, listOf(0, 1, 2, 3))
        renderExpectingBadRequest(token, missingTimingSong.id!!, listOf(0, 1, 2, 3))
        renderExpectingBadRequest(token, missingTimingSong.id!!, listOf(0, 1, 1, 3))
        renderExpectingBadRequest(token, missingTimingSong.id!!, listOf(0, 1, 99, 3))
        renderExpectingBadRequest(token, missingTimingSong.id!!, listOf(0, 1, 2))

        // 줄 간격 2초짜리 40줄 — 첫 줄부터 마지막 줄까지 78초라 60초 상한을 넘는다
        val longSpanSong = TestSongBuilder(entityManager).withYoutubeUrl("https://youtu.be/long-span").build()
        persistLyric(longSpanSong.id!!, analyzed = true, lineCount = 40)
        renderExpectingBadRequest(token, longSpanSong.id!!, listOf(0, 1, 2, 39))
    }

    @Test
    fun `reels factory preview returns player props and streams cached mv with media token`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("Lemon")
            .withArtist("米津玄師")
            .withYoutubeUrl("https://youtu.be/SX_ViT4Ra7k")
            .build()
        persistLyric(song.id!!, analyzed = true, lineCount = 7)
        val token = adminToken()

        // 미리보기도 렌더와 같은 acknowledgement 를 요구한다
        mockMvc.post("/admin/api/reels-factory/preview") {
            header("Authorization", "Bearer $token")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                AdminReelsRenderRequest(songId = song.id!!, lineIndexes = listOf(0, 1, 2, 3), acknowledgeSourceRightsAndPlatformRisk = false),
            )
        }.andExpect {
            status { isBadRequest() }
        }

        val previewBody = mockMvc.post("/admin/api/reels-factory/preview") {
            header("Authorization", "Bearer $token")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                AdminReelsRenderRequest(songId = song.id!!, lineIndexes = listOf(1, 2, 3, 4, 5), acknowledgeSourceRightsAndPlatformRisk = true),
            )
        }.andExpect {
            status { isOk() }
            jsonPath("$.data.song.title") { value("Lemon") }
            jsonPath("$.data.song.mvAsset") { value("") }
            jsonPath("$.data.sourceStartFrame") { value(60) }
            jsonPath("$.data.lyricsEndFrame") { value(300) }
            jsonPath("$.data.lyricLines.length()") { value(5) }
            jsonPath("$.mvPath") { value(org.hamcrest.Matchers.startsWith("/reels-factory/songs/${song.id}/mv?token=")) }
        }.andReturn().response.contentAsString
        assertThat(fakeSourceCache.fetchCount).isEqualTo(1)
        assertThat(fakeRenderer.lastInput).isNull()

        val mvPath = objectMapper.readTree(previewBody)["mvPath"].asText()
        val mediaToken = mvPath.substringAfter("token=")

        // 미디어 토큰만으로 스트리밍 — Authorization 헤더 없음
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}/mv") {
            param("token", mediaToken)
        }.andExpect {
            status { isOk() }
            header { string("Content-Type", "video/mp4") }
            header { string("Accept-Ranges", "bytes") }
            content { bytes("fake source mp4".toByteArray()) }
        }

        // Range 요청은 206 으로 잘라 준다
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}/mv") {
            param("token", mediaToken)
            header("Range", "bytes=0-3")
        }.andExpect {
            status { isPartialContent() }
            header { string("Content-Range", "bytes 0-3/15") }
            content { bytes("fake".toByteArray()) }
        }

        // 미디어 토큰은 다른 곡·어드민 토큰에는 안 통한다
        mockMvc.get("/admin/api/reels-factory/songs/${song.id!! + 1}/mv") {
            param("token", mediaToken)
        }.andExpect {
            status { isUnauthorized() }
        }
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}/mv") {
            param("token", token)
        }.andExpect {
            status { isUnauthorized() }
        }
        // 어드민 토큰을 헤더에 붙여도 미디어 토큰이 없으면 안 된다 (query 파라미터 필수)
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}/mv") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isBadRequest() }
        }
        // 미디어 토큰으로는 일반 어드민 API 를 못 쓴다
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}") {
            header("Authorization", "Bearer $mediaToken")
        }.andExpect {
            status { isForbidden() }
        }

        // 캐시에 없으면 404 — GET 은 다운로드를 시작하지 않는다
        fakeSourceCache.clear()
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}/mv") {
            param("token", mediaToken)
        }.andExpect {
            status { isNotFound() }
        }
        assertThat(fakeSourceCache.fetchCount).isEqualTo(1)
    }

    private fun renderExpectingBadRequest(token: String, songId: Long, lineIndexes: List<Int>) {
        mockMvc.post("/admin/api/reels-factory/render") {
            header("Authorization", "Bearer $token")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                AdminReelsRenderRequest(
                    songId = songId,
                    lineIndexes = lineIndexes,
                    acknowledgeSourceRightsAndPlatformRisk = true,
                ),
            )
        }.andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("bad_request") }
        }
    }

    private fun persistLyric(
        songId: Long,
        analyzed: Boolean = false,
        lineCount: Int = 1,
        missingTimingIndex: Int? = null,
    ): LyricEntity {
        val rawContent = (0 until lineCount).map { index ->
            LyricLineData(
                index = index,
                startTimeMs = if (index == missingTimingIndex) null else index * 2_000L,
                text = if (lineCount == 1) "歌詞" else "歌詞$index",
            )
        }
        val lyric = LyricEntity(
            songId = songId,
            lyricType = LyricType.PLAIN,
            rawContent = rawContent,
            analyzedContent = if (analyzed) rawContent.map {
                AnalyzedLine(
                    index = it.index,
                    koreanLyrics = "가사${it.index}",
                    tokens = listOf(
                        Token(
                            surface = "夢",
                            baseForm = "夢",
                            reading = "ユメ",
                            baseFormReading = "ユメ",
                            partOfSpeech = PartOfSpeech.NOUN,
                            charStart = 0,
                            charEnd = 1,
                            koreanText = "꿈",
                            jlpt = "N5",
                        ),
                    ),
                )
            } else null,
        )
        entityManager.persist(lyric)
        entityManager.flush()
        entityManager.find(SongEntity::class.java, songId).activeLyricId = lyric.id
        entityManager.flush()
        return lyric
    }

    @TestConfiguration
    class ReelsFactoryTestConfig {
        @Bean
        @Primary
        fun fakeReelsRenderService(): FakeReelsRenderService = FakeReelsRenderService()

        @Bean
        @Primary
        fun fakeReelsSourceCache(): FakeReelsSourceCache = FakeReelsSourceCache()
    }

    class FakeReelsSourceCache : AdminReelsSourceCache {
        private val files = mutableMapOf<String, Path>()
        var fetchCount = 0

        override fun fetch(youtubeUrl: String): Path {
            fetchCount += 1
            return files.getOrPut(youtubeUrl) {
                val dir = Files.createTempDirectory("fake-reels-source-")
                dir.resolve("source.mp4").also { Files.write(it, "fake source mp4".toByteArray()) }
            }
        }

        override fun cached(youtubeUrl: String): Path? = files[youtubeUrl]

        fun clear() = files.clear()
    }

    class FakeReelsRenderService : AdminReelsRenderService {
        var lastInput: AdminReelsRenderInput? = null
        var failWith: RuntimeException? = null

        override fun render(input: AdminReelsRenderInput): Path {
            lastInput = input
            failWith?.let { exception ->
                failWith = null
                throw exception
            }
            val dir = Files.createTempDirectory("fake-reels-")
            val output = dir.resolve("reel.mp4")
            Files.write(output, "fake mp4".toByteArray())
            return output
        }
    }
}
