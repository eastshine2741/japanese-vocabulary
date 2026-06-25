package com.japanese.vocabulary.recommendation.batch

import com.japanese.vocabulary.recommendation.entity.RecommendationCandidateStatus
import com.japanese.vocabulary.recommendation.entity.RecommendationSource
import com.japanese.vocabulary.recommendation.entity.SongRecommendationCandidateEntity
import com.japanese.vocabulary.recommendation.repository.SongRecommendationCandidateRepository
import com.japanese.vocabulary.recommendation.repository.SongRecommendationRepository
import com.japanese.vocabulary.recommendation.entity.SongRecommendationEntity
import com.japanese.vocabulary.recommendation.entity.SongRecommendationStatus
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import java.time.Instant
import java.time.LocalDate

class SongRecommendationCandidateRepositoryIntegrationTest : BatchBaseIntegrationTest() {
    @Autowired
    private lateinit var candidateRepository: SongRecommendationCandidateRepository

    @Autowired
    private lateinit var recommendationRepository: SongRecommendationRepository

    @Test
    fun `approved awaiting recommendation query does not starve completed work behind incomplete rows`() {
        val weekStartDate = LocalDate.of(2026, 6, 22)
        val completedWork = completedWork("Ready", "Artist")
        val notAnalyzedWork = completedWork("Not Analyzed", "Artist", analyzed = false)
        val runningWork = work("Running", "Artist", SongAnalysisWorkStatus.RUNNING)
        val failedWork = work("Failed", "Artist", SongAnalysisWorkStatus.FAILED)

        candidate("running", sourceRank = 1, weekStartDate = weekStartDate, workId = runningWork.id!!)
        candidate("failed", sourceRank = 2, weekStartDate = weekStartDate, workId = failedWork.id!!)
        candidate("not-analyzed", sourceRank = 3, weekStartDate = weekStartDate, workId = notAnalyzedWork.id!!)
        val ready = candidate("ready", sourceRank = 4, weekStartDate = weekStartDate, workId = completedWork.id!!)
        entityManager.flush()
        entityManager.clear()

        val result = candidateRepository.findApprovedAwaitingRecommendation(PageRequest.of(0, 1))

        assertThat(result).extracting<Long> { it.id }.containsExactly(ready.id)
    }

    @Test
    fun `latest published ready query enforces candidate work and lyric safety gates`() {
        val weekStartDate = LocalDate.of(2026, 6, 22)
        val completedWork = completedWork("Ready", "Artist")
        val unsafeSongWork = completedWork("Unsafe", "Artist")
        val incompleteWork = work("Incomplete", "Artist", SongAnalysisWorkStatus.COMPLETED)
        val readyCandidate = candidate("ready-safe", sourceRank = 1, weekStartDate = weekStartDate, workId = completedWork.id!!)
        readyCandidate.linkAnalyzedSong(songId = completedWork.songId!!, lyricId = completedWork.lyricId!!)
        val unsafeCandidate = candidate("unsafe-incomplete", sourceRank = 2, weekStartDate = weekStartDate, workId = incompleteWork.id!!)
        unsafeCandidate.linkAnalyzedSong(songId = unsafeSongWork.songId!!, lyricId = unsafeSongWork.lyricId!!)
        val readyRecommendation = recommendation(candidate = readyCandidate, songId = completedWork.songId!!, lyricId = completedWork.lyricId!!)
        recommendation(candidate = unsafeCandidate, songId = unsafeSongWork.songId!!, lyricId = unsafeSongWork.lyricId!!)
        entityManager.flush()
        entityManager.clear()

        val result = recommendationRepository.findLatestPublishedReadyRecommendations()

        assertThat(result).extracting<Long> { it.getId() }.containsExactly(readyRecommendation.id)
        assertThat(result.first().getSongId()).isEqualTo(completedWork.songId)
    }

    private fun completedWork(title: String, artist: String, analyzed: Boolean = true): SongAnalysisWorkEntity {
        val song = SongEntity(title = title, artist = artist, youtubeUrl = "https://youtube.example/$title")
        entityManager.persist(song)
        entityManager.flush()

        val lyric = LyricEntity(
            songId = song.id!!,
            lyricType = LyricType.PLAIN,
            rawContent = emptyList(),
            analyzedContent = if (analyzed) emptyList() else null,
        )
        entityManager.persist(lyric)
        entityManager.flush()
        if (!analyzed) {
            entityManager.createNativeQuery("UPDATE lyrics SET analyzed_content = NULL WHERE id = :id")
                .setParameter("id", lyric.id)
                .executeUpdate()
            entityManager.flush()
        }

        return work(
            title = title,
            artist = artist,
            status = SongAnalysisWorkStatus.COMPLETED,
            songId = song.id,
            lyricId = lyric.id,
            playerReadyAt = Instant.parse("2026-06-25T00:00:00Z"),
        )
    }

    private fun work(
        title: String,
        artist: String,
        status: SongAnalysisWorkStatus,
        songId: Long? = null,
        lyricId: Long? = null,
        playerReadyAt: Instant? = null,
    ): SongAnalysisWorkEntity {
        val work = SongAnalysisWorkEntity(
            rawTitle = title,
            rawArtist = artist,
            status = status,
            triggerSource = SongAnalysisTriggerSource.RECOMMENDATION,
            songId = songId,
            lyricId = lyricId,
            playerReadyAt = playerReadyAt,
        )
        entityManager.persist(work)
        entityManager.flush()
        return work
    }

    private fun candidate(
        sourceSongId: String,
        sourceRank: Int,
        weekStartDate: LocalDate,
        workId: Long,
    ): SongRecommendationCandidateEntity {
        val candidate = SongRecommendationCandidateEntity(
            source = RecommendationSource.APPLE_MUSIC_RSS,
            sourceSongId = sourceSongId,
            weekStartDate = weekStartDate,
            sourceRank = sourceRank,
            status = RecommendationCandidateStatus.APPROVED,
            title = sourceSongId,
            artistName = "Artist",
            songAnalysisWorkId = workId,
        )
        entityManager.persist(candidate)
        entityManager.flush()
        return candidate
    }

    private fun recommendation(
        candidate: SongRecommendationCandidateEntity,
        songId: Long,
        lyricId: Long,
    ): SongRecommendationEntity {
        val recommendation = SongRecommendationEntity(
            candidateId = candidate.id!!,
            weekStartDate = candidate.weekStartDate,
            status = SongRecommendationStatus.PUBLISHED,
            songId = songId,
            lyricId = lyricId,
        )
        entityManager.persist(recommendation)
        entityManager.flush()
        return recommendation
    }
}
