package com.japanese.vocabulary.admin

import com.japanese.vocabulary.recommendation.entity.RecommendationCandidateStatus
import com.japanese.vocabulary.recommendation.entity.RecommendationSource
import com.japanese.vocabulary.recommendation.entity.SongRecommendationCandidateEntity
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.post
import java.time.Instant
import java.time.LocalDate

@AutoConfigureMockMvc
class AdminRecommendationControllerTest : AdminBaseIntegrationTest() {
    @Test
    fun `dispatch analysis creates and links recommendation analysis work`() {
        val candidate = persistApprovedCandidate(
            sourceSongId = "apple-1",
            title = "推薦曲",
            artistName = "推薦歌手",
            sourceRank = 1,
        )

        mockMvc.post("/admin/api/recommendations/dispatch-analysis") {
            header("Authorization", "Bearer ${adminToken()}")
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
    fun `reconcile completed work creates pending recommendation`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("完成曲")
            .withArtist("完成歌手")
            .build()
        val lyric = persistAnalyzedLyric(song.id!!)
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
            header("Authorization", "Bearer ${adminToken()}")
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
    ): SongRecommendationCandidateEntity {
        val candidate = SongRecommendationCandidateEntity(
            source = RecommendationSource.APPLE_MUSIC_RSS,
            sourceSongId = sourceSongId,
            weekStartDate = LocalDate.parse("2026-01-05"),
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
