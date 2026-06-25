package com.japanese.vocabulary.admin

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.admin.dto.AdminLoginRequest
import com.japanese.vocabulary.admin.dto.AdminLoginResponse
import com.japanese.vocabulary.recommendation.entity.RecommendationCandidateStatus
import com.japanese.vocabulary.recommendation.entity.RecommendationSource
import com.japanese.vocabulary.recommendation.entity.SongRecommendationCandidateEntity
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
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
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping
import java.time.Instant

@AutoConfigureMockMvc
class AdminApiIntegrationTest : AdminBaseIntegrationTest() {
    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var requestMappingHandlerMapping: RequestMappingHandlerMapping

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
    fun `admin api has no resource mutation mappings beyond login`() {
        val mutatingMappings = requestMappingHandlerMapping.handlerMethods.keys
            .filter { it.patternValues.any { pattern -> pattern.startsWith("/admin/api/") } }
            .flatMap { info ->
                info.methodsCondition.methods.map { method -> "${method.name} ${info.patternValues}" }
            }
            .filterNot {
                it in setOf(
                    "POST [/admin/api/auth/login]",
                    "POST [/admin/api/recommendations/dispatch-analysis]",
                    "POST [/admin/api/recommendations/reconcile-completed]",
                )
            }
            .filter { it.startsWith("POST ") || it.startsWith("PUT ") || it.startsWith("PATCH ") || it.startsWith("DELETE ") }

        assertThat(mutatingMappings).isEmpty()
    }

    @Test
    fun `admin can dispatch approved recommendation candidates to analysis work`() {
        val candidate = persistApprovedCandidate(
            sourceSongId = "apple-1",
            title = "推薦曲",
            artistName = "推薦歌手",
            sourceRank = 1,
        )

        mockMvc.post("/admin/api/recommendations/dispatch-analysis") {
            header("Authorization", "Bearer ${login()}")
            param("limit", "10")
        }.andExpect {
            status { isOk() }
            jsonPath("$.processed") { value(1) }
            jsonPath("$.succeeded") { value(1) }
            jsonPath("$.failed") { value(0) }
            jsonPath("$.items[0].candidateId") { value(candidate.id!!.toInt()) }
            jsonPath("$.items[0].workId") { exists() }
        }

        entityManager.flush()
        entityManager.clear()

        val linkedWorkId = entityManager
            .createQuery(
                "SELECT c.songAnalysisWorkId FROM SongRecommendationCandidateEntity c WHERE c.id = :id",
                Long::class.java,
            )
            .setParameter("id", candidate.id)
            .singleResult
        val work = entityManager.find(SongAnalysisWorkEntity::class.java, linkedWorkId)
        assertThat(work.rawTitle).isEqualTo("推薦曲")
        assertThat(work.rawArtist).isEqualTo("推薦歌手")
        assertThat(work.triggerSource).isEqualTo(SongAnalysisTriggerSource.RECOMMENDATION)
    }

    @Test
    fun `admin can reconcile completed recommendation analysis work to pending recommendation`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("完成曲")
            .withArtist("完成歌手")
            .build()
        val lyric = persistLyric(song.id!!).also {
            it.analyzedContent = listOf(
                AnalyzedLine(
                    index = 0,
                    koreanLyrics = "완성된 가사",
                    koreanPronounciation = null,
                    tokens = listOf(
                        Token(
                            surface = "完成",
                            baseForm = "完成",
                            reading = null,
                            baseFormReading = null,
                            partOfSpeech = PartOfSpeech.NOUN,
                            charStart = 0,
                            charEnd = 2,
                        ),
                    ),
                ),
            )
        }
        val work = SongAnalysisWorkEntity(
            rawTitle = "完成曲",
            rawArtist = "完成歌手",
            activeDedupKey = SongAnalysisWorkService.buildActiveDedupKey("完成曲", "完成歌手"),
            triggerSource = SongAnalysisTriggerSource.RECOMMENDATION,
            status = SongAnalysisWorkStatus.COMPLETED,
        )
        work.songId = song.id
        work.lyricId = lyric.id
        work.playerReadyAt = Instant.parse("2026-01-01T00:01:00Z")
        work.completedAt = Instant.parse("2026-01-01T00:03:00Z")
        entityManager.persist(work)
        val candidate = persistApprovedCandidate(
            sourceSongId = "apple-2",
            title = "完成曲",
            artistName = "完成歌手",
            sourceRank = 2,
        )
        candidate.songAnalysisWorkId = work.id
        entityManager.flush()

        mockMvc.post("/admin/api/recommendations/reconcile-completed") {
            header("Authorization", "Bearer ${login()}")
            param("limit", "10")
        }.andExpect {
            status { isOk() }
            jsonPath("$.processed") { value(1) }
            jsonPath("$.succeeded") { value(1) }
            jsonPath("$.failed") { value(0) }
            jsonPath("$.items[0].candidateId") { value(candidate.id!!.toInt()) }
            jsonPath("$.items[0].recommendationId") { exists() }
        }

        val recommendationCount = entityManager
            .createNativeQuery("SELECT COUNT(*) FROM song_recommendation WHERE candidate_id = :candidateId")
            .setParameter("candidateId", candidate.id)
            .singleResult as Number
        assertThat(recommendationCount.toLong()).isEqualTo(1)
    }

    private fun login(): String {
        val body = mockMvc.post("/admin/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(AdminLoginRequest(password = "test-admin-password"))
        }.andExpect { status { isOk() } }
            .andReturn().response.contentAsString

        return objectMapper.readValue(body, AdminLoginResponse::class.java).token
    }

    private fun persistLyric(songId: Long): LyricEntity {
        val lyric = LyricEntity(
            songId = songId,
            lyricType = LyricType.PLAIN,
            rawContent = listOf(LyricLineData(index = 0, startTimeMs = 0, text = "歌詞")),
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

    private fun persistApprovedCandidate(
        sourceSongId: String,
        title: String,
        artistName: String,
        sourceRank: Int,
    ): SongRecommendationCandidateEntity {
        val candidate = SongRecommendationCandidateEntity(
            source = RecommendationSource.APPLE_MUSIC_RSS,
            sourceSongId = sourceSongId,
            weekStartDate = java.time.LocalDate.parse("2026-01-05"),
            sourceRank = sourceRank,
            status = RecommendationCandidateStatus.APPROVED,
            title = title,
            artistName = artistName,
            durationSeconds = 180,
            artworkUrl = "https://example.com/artwork.jpg",
            sourceUrl = "https://music.apple.com/song/$sourceSongId",
        )
        candidate.approvedAt = Instant.parse("2026-01-01T00:00:00Z")
        entityManager.persist(candidate)
        entityManager.flush()
        return candidate
    }
}
