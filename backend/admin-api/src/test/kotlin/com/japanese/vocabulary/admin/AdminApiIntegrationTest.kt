package com.japanese.vocabulary.admin

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.admin.dto.AdminLoginRequest
import com.japanese.vocabulary.admin.dto.AdminLoginResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsRenderRequest
import com.japanese.vocabulary.admin.reels.AdminReelsRenderFailedException
import com.japanese.vocabulary.admin.reels.AdminReelsRenderService
import com.japanese.vocabulary.admin.reels.model.AdminReelsRenderInput
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.NoSuchBeanDefinitionException
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping
import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant

@AutoConfigureMockMvc
@Import(AdminApiIntegrationTest.ReelsFactoryTestConfig::class)
class AdminApiIntegrationTest : AdminBaseIntegrationTest() {
    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var requestMappingHandlerMapping: RequestMappingHandlerMapping
    @Autowired private lateinit var fakeRenderer: FakeReelsRenderService

    @Test
    fun `admin api starts without song runtime beans`() {
        listOf(
            "youtubeClient",
            "lrclibClient",
            "vocadbClient",
            "songSearchCache",
            "recentSongService",
        ).forEach { beanName ->
            org.junit.jupiter.api.assertThrows<NoSuchBeanDefinitionException> {
                applicationContext.getBean(beanName)
            }
        }
    }

    @Test
    fun `login accepts password and authenticated reads can inspect entities`() {
        val user = TestUserBuilder(entityManager)
            .withUsername("adminread")
            .withEmail("adminread@example.com")
            .build()
        val song = TestSongBuilder(entityManager)
            .withTitle("管理曲")
            .withArtist("管理歌手")
            .withYoutubeUrl("https://youtu.be/admin")
            .build()
        persistLyric(song.id!!)

        val token = login()

        mockMvc.get("/admin/api/songs") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].title") { value("管理曲") }
        }

        mockMvc.get("/admin/api/songs/${song.id}") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.lyric.id") { value(lyricIdForSong(song.id!!).toInt()) }
        }

        mockMvc.get("/admin/api/songs/${song.id}/lyric") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.rawContent[0].text") { value("歌詞") }
        }

        mockMvc.get("/admin/api/lyrics") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].songId") { value(song.id!!.toInt()) }
            jsonPath("$.content[0].status") { doesNotExist() }
        }

        mockMvc.get("/admin/api/song-analysis-works") {
            header("Authorization", "Bearer $token")
            param("status", "PENDING")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].rawTitle") { value("管理曲") }
            jsonPath("$.content[0].status") { value("PENDING") }
        }

        mockMvc.get("/admin/api/song-analysis-works/${workIdForSong(song.id!!)}") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.status") { value("PENDING") }
            jsonPath("$.stageTimings") { doesNotExist() }
        }

        mockMvc.get("/admin/api/users/${user.id}") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.email") { value("adminread@example.com") }
        }
    }

    @Test
    fun `login failure is unauthorized and unauthenticated admin reads are rejected`() {
        mockMvc.post("/admin/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(AdminLoginRequest(password = "wrong"))
        }.andExpect { status { isUnauthorized() } }

        mockMvc.get("/admin/api/songs")
            .andExpect { status { isForbidden() } }
    }

    @Test
    fun `public app jwt shaped token is not accepted as admin token`() {
        mockMvc.get("/admin/api/users") {
            header("Authorization", "Bearer not-an-admin-token")
        }.andExpect { status { isForbidden() } }
    }

    @Test
    fun `soft deleted users stay visible to admin detail`() {
        val user = TestUserBuilder(entityManager).withUsername("deleteduser").build()
        user.deletedAt = Instant.parse("2026-01-01T00:00:00Z")
        entityManager.flush()

        mockMvc.get("/admin/api/users/${user.id}") {
            header("Authorization", "Bearer ${login()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.deletedAt") { exists() }
        }
    }

    @Test
    fun `reels factory lists candidates and exposes analyzed timed lines`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("Lemon")
            .withArtist("米津玄師")
            .withYoutubeUrl("https://youtu.be/SX_ViT4Ra7k")
            .build()
        persistLyric(song.id!!, analyzed = true, lineCount = 4)

        mockMvc.get("/admin/api/reels-factory/songs") {
            header("Authorization", "Bearer ${login()}")
            param("q", "lem")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].title") { value("Lemon") }
            jsonPath("$.content[0].hasAnalyzedLyrics") { value(true) }
            jsonPath("$.content[0].renderEligible") { value(true) }
        }

        mockMvc.get("/admin/api/reels-factory/songs/${song.id}") {
            header("Authorization", "Bearer ${login()}")
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
        val token = login()

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
            header("Authorization", "Bearer ${login()}")
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
        val token = login()

        renderExpectingBadRequest(token, noAnalysisSong.id!!, listOf(0, 1, 2, 3))
        renderExpectingBadRequest(token, noYoutubeSong.id!!, listOf(0, 1, 2, 3))
        renderExpectingBadRequest(token, missingTimingSong.id!!, listOf(0, 1, 2, 3))
        renderExpectingBadRequest(token, missingTimingSong.id!!, listOf(0, 1, 1, 3))
        renderExpectingBadRequest(token, missingTimingSong.id!!, listOf(0, 1, 99, 3))
        renderExpectingBadRequest(token, missingTimingSong.id!!, listOf(0, 1, 2))
    }

    @Test
    fun `admin api mutation mappings are explicitly allowlisted`() {
        val mutatingMappings = requestMappingHandlerMapping.handlerMethods.keys
            .filter { it.patternValues.any { pattern -> pattern.startsWith("/admin/api/") } }
            .flatMap { info ->
                info.methodsCondition.methods.map { method -> "${method.name} ${info.patternValues}" }
            }
            .filter { it.startsWith("POST ") || it.startsWith("PUT ") || it.startsWith("PATCH ") || it.startsWith("DELETE ") }

        assertThat(mutatingMappings).containsExactlyInAnyOrder(
            "POST [/admin/api/auth/login]",
            "POST [/admin/api/reels-factory/render]",
        )
    }

    private fun login(): String {
        val body = mockMvc.post("/admin/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(AdminLoginRequest(password = "test-admin-password"))
        }.andExpect { status { isOk() } }
            .andReturn().response.contentAsString

        return objectMapper.readValue(body, AdminLoginResponse::class.java).token
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
                    koreanPronounciation = null,
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

        val work = SongAnalysisWorkEntity(
            rawTitle = "管理曲",
            rawArtist = "管理歌手",
            triggerSource = SongAnalysisTriggerSource.USER_APP,
            status = SongAnalysisWorkStatus.PENDING,
        )
        work.songId = songId
        work.lyricId = requireNotNull(lyric.id)
        entityManager.persist(work)
        entityManager.flush()
        return lyric
    }

    private fun lyricIdForSong(songId: Long): Long {
        return entityManager
            .createQuery("SELECT l.id FROM LyricEntity l WHERE l.songId = :songId", Long::class.java)
            .setParameter("songId", songId)
            .singleResult
    }

    private fun workIdForSong(songId: Long): Long {
        return entityManager
            .createQuery("SELECT w.id FROM SongAnalysisWorkEntity w WHERE w.songId = :songId", Long::class.java)
            .setParameter("songId", songId)
            .singleResult
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
