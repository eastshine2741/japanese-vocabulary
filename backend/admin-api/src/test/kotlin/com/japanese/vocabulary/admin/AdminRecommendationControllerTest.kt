package com.japanese.vocabulary.admin

import com.japanese.vocabulary.recommendation.entity.RecommendationCandidateStatus
import com.japanese.vocabulary.recommendation.entity.RecommendationSource
import com.japanese.vocabulary.recommendation.entity.SongRecommendationCandidateEntity
import com.japanese.vocabulary.recommendation.entity.SongRecommendationEntity
import com.japanese.vocabulary.recommendation.entity.SongRecommendationStatus
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.options
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.post
import java.time.Instant
import java.time.LocalDate

@AutoConfigureMockMvc
class AdminRecommendationControllerTest : AdminBaseIntegrationTest() {
    @Test
    fun `cors preflight allows patch recommendation status updates`() {
        mockMvc.options("/admin/api/recommendations/candidates/1/status") {
            header("Origin", "http://localhost:5175")
            header("Access-Control-Request-Method", "PATCH")
            header("Access-Control-Request-Headers", "authorization,content-type")
        }.andExpect {
            status { isOk() }
            header { string("Access-Control-Allow-Methods", org.hamcrest.Matchers.containsString("PATCH")) }
        }
    }

    @Test
    fun `list candidates returns latest week candidates`() {
        persistApprovedCandidate(
            sourceSongId = "apple-old",
            title = "오래된 후보",
            artistName = "Old Artist",
            sourceRank = 1,
            weekStartDate = LocalDate.parse("2026-01-05"),
        )
        val latest = persistApprovedCandidate(
            sourceSongId = "apple-latest",
            title = "최신 후보",
            artistName = "Latest Artist",
            sourceRank = 2,
            weekStartDate = LocalDate.parse("2099-01-05"),
        )

        mockMvc.get("/admin/api/recommendations/candidates") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$[0].id") { value(latest.id!!.toInt()) }
            jsonPath("$[0].title") { value("최신 후보") }
            jsonPath("$[0].artistName") { value("Latest Artist") }
            jsonPath("$[0].weekStartDate") { value("2099-01-05") }
            jsonPath("$[0].status") { value("APPROVED") }
        }
    }

    @Test
    fun `request analysis creates recommendation analysis work for selected candidates`() {
        val candidate = persistApprovedCandidate(
            sourceSongId = "apple-1",
            title = "推薦曲",
            artistName = "推薦歌手",
            sourceRank = 1,
        )

        mockMvc.post("/admin/api/recommendations/request-analysis") {
            header("Authorization", "Bearer ${adminToken()}")
            contentType = MediaType.APPLICATION_JSON
            content = """{"candidateIds":[${candidate.id}]}"""
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

        val work = entityManager
            .createQuery(
                "SELECT w FROM SongAnalysisWorkEntity w WHERE w.rawTitle = :title AND w.rawArtist = :artist",
                SongAnalysisWorkEntity::class.java,
            )
            .setParameter("title", "推薦曲")
            .setParameter("artist", "推薦歌手")
            .singleResult
        assertThat(work.rawTitle).isEqualTo("推薦曲")
        assertThat(work.rawArtist).isEqualTo("推薦歌手")
        assertThat(work.triggerSource).isEqualTo(SongAnalysisTriggerSource.RECOMMENDATION)
    }

    @Test
    fun `update candidate status approves and rejects without direct db edits`() {
        val candidate = SongRecommendationCandidateEntity(
            source = RecommendationSource.APPLE_MUSIC_RSS,
            sourceSongId = "apple-review",
            weekStartDate = LocalDate.parse("2026-01-05"),
            sourceRank = 1,
            status = RecommendationCandidateStatus.PENDING,
            title = "검수곡",
            artistName = "검수가수",
        )
        entityManager.persist(candidate)
        entityManager.flush()

        mockMvc.patch("/admin/api/recommendations/candidates/${candidate.id}/status") {
            header("Authorization", "Bearer ${adminToken()}")
            contentType = MediaType.APPLICATION_JSON
            content = """{"status":"APPROVED"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.status") { value("APPROVED") }
        }

        entityManager.flush()
        entityManager.clear()

        val approved = entityManager.find(SongRecommendationCandidateEntity::class.java, candidate.id)
        assertThat(approved.status).isEqualTo(RecommendationCandidateStatus.APPROVED)
        assertThat(approved.approvedAt).isNotNull()
    }

    @Test
    fun `prepare approved creates pending recommendation from existing analyzed song without work`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("既存分析曲")
            .withArtist("既存歌手")
            .build()
        val lyric = persistAnalyzedLyric(song.id!!)
        song.activeLyricId = lyric.id
        entityManager.flush()
        val candidate = persistApprovedCandidate(
            sourceSongId = "apple-existing",
            title = "既存分析曲",
            artistName = "既存歌手",
            sourceRank = 1,
        )

        mockMvc.post("/admin/api/recommendations/prepare-approved") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.processed") { value(1) }
            jsonPath("$.succeeded") { value(1) }
            jsonPath("$.items[0].candidateId") { value(candidate.id!!.toInt()) }
            jsonPath("$.items[0].workId") { doesNotExist() }
            jsonPath("$.items[0].songId") { value(song.id!!.toInt()) }
            jsonPath("$.items[0].lyricId") { value(lyric.id!!.toInt()) }
            jsonPath("$.items[0].recommendationId") { exists() }
        }

        entityManager.flush()
        entityManager.clear()

        val recommendationCount = entityManager
            .createNativeQuery("SELECT COUNT(*) FROM song_recommendation WHERE candidate_id = :candidateId")
            .setParameter("candidateId", candidate.id)
            .singleResult as Number
        assertThat(recommendationCount.toLong()).isEqualTo(1)
    }

    @Test
    fun `prepare approved returns 422 with matching ids when any approved candidate is missing analyzed song`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("既存曲")
            .withArtist("既存歌手")
            .build()
        val lyric = persistAnalyzedLyric(song.id!!)
        song.activeLyricId = lyric.id
        entityManager.flush()
        val ready = persistApprovedCandidate(
            sourceSongId = "apple-ready",
            title = "既存曲",
            artistName = "既存歌手",
            sourceRank = 1,
        )
        val missing = persistApprovedCandidate(
            sourceSongId = "apple-missing",
            title = "없는곡",
            artistName = "없는가수",
            sourceRank = 2,
        )

        mockMvc.post("/admin/api/recommendations/prepare-approved") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isUnprocessableEntity() }
            jsonPath("$.processed") { value(2) }
            jsonPath("$.succeeded") { value(0) }
            jsonPath("$.skipped") { value(1) }
            jsonPath("$.failed") { value(1) }
            jsonPath("$.items[0].candidateId") { value(ready.id!!.toInt()) }
            jsonPath("$.items[0].status") { value("READY") }
            jsonPath("$.items[0].songId") { value(song.id!!.toInt()) }
            jsonPath("$.items[1].candidateId") { value(missing.id!!.toInt()) }
            jsonPath("$.items[1].status") { value("MISSING_SONG") }
            jsonPath("$.items[1].songId") { doesNotExist() }
        }

        val recommendationCount = entityManager
            .createNativeQuery("SELECT COUNT(*) FROM song_recommendation")
            .singleResult as Number
        assertThat(recommendationCount.toLong()).isZero()
    }

    @Test
    fun `update recommendation order and publish without direct db edits`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("게시곡")
            .withArtist("게시가수")
            .build()
        val lyric = persistAnalyzedLyric(song.id!!)
        song.activeLyricId = lyric.id
        entityManager.flush()
        val candidate = persistApprovedCandidate(
            sourceSongId = "apple-publish",
            title = "게시곡",
            artistName = "게시가수",
            sourceRank = 1,
        )
        val recommendation = SongRecommendationEntity(
            candidateId = candidate.id!!,
            weekStartDate = candidate.weekStartDate,
            songId = song.id!!,
            lyricId = lyric.id!!,
        )
        entityManager.persist(recommendation)
        entityManager.flush()

        mockMvc.patch("/admin/api/recommendations/${recommendation.id}") {
            header("Authorization", "Bearer ${adminToken()}")
            contentType = MediaType.APPLICATION_JSON
            content = """{"status":"PUBLISHED","orderIndex":7}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.status") { value("PUBLISHED") }
            jsonPath("$.orderIndex") { value(7) }
        }

        entityManager.flush()
        entityManager.clear()

        val refreshed = entityManager.find(SongRecommendationEntity::class.java, recommendation.id)
        assertThat(refreshed.status).isEqualTo(SongRecommendationStatus.PUBLISHED)
        assertThat(refreshed.orderIndex).isEqualTo(7)
        assertThat(refreshed.publishedAt).isNotNull()
    }

    private fun persistAnalyzedLyric(songId: Long): LyricEntity {
        val lyric = LyricEntity(
            songId = songId,
            lyricType = LyricType.PLAIN,
            rawContent = listOf(LyricLineData(index = 0, startTimeMs = 0, text = "歌詞")),
            analyzedContent = listOf(
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
            ),
        )
        entityManager.persist(lyric)
        entityManager.flush()
        return lyric
    }

    private fun persistApprovedCandidate(
        sourceSongId: String,
        title: String,
        artistName: String,
        sourceRank: Int,
        weekStartDate: LocalDate = LocalDate.parse("2026-01-05"),
    ): SongRecommendationCandidateEntity {
        val candidate = SongRecommendationCandidateEntity(
            source = RecommendationSource.APPLE_MUSIC_RSS,
            sourceSongId = sourceSongId,
            weekStartDate = weekStartDate,
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
