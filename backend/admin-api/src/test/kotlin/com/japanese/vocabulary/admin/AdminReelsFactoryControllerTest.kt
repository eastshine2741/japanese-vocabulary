package com.japanese.vocabulary.admin

import com.japanese.vocabulary.admin.dto.reels.AdminReelsRenderRequest
import com.japanese.vocabulary.admin.reels.AdminReelsRenderFailedException
import com.japanese.vocabulary.admin.reels.AdminReelsRenderService
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
                    lineIndexes = listOf(0, 1, 2, 3, 4, 5, 6),
                    acknowledgeSourceRightsAndPlatformRisk = true,
                ),
            )
        }.andExpect {
            status { isOk() }
            header { string("Content-Type", "video/mp4") }
            header { string("Content-Disposition", "attachment; filename=\"kotonoha-reel-${song.id}.mp4\"") }
        }

        assertThat(fakeRenderer.lastInput?.source?.youtubeUrl).isEqualTo("https://youtu.be/SX_ViT4Ra7k")
        assertThat(fakeRenderer.lastInput?.data?.lyricLines).hasSize(7)
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
