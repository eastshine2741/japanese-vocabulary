package com.japanese.vocabulary.recommendation.batch

import com.japanese.vocabulary.recommendation.entity.RecommendationCandidateStatus
import com.japanese.vocabulary.recommendation.entity.RecommendationSource
import com.japanese.vocabulary.recommendation.entity.SongRecommendationCandidateEntity
import com.japanese.vocabulary.recommendation.repository.SongRecommendationRepository
import com.japanese.vocabulary.recommendation.entity.SongRecommendationEntity
import com.japanese.vocabulary.recommendation.entity.SongRecommendationStatus
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.time.LocalDate

class SongRecommendationCandidateRepositoryIntegrationTest : BatchBaseIntegrationTest() {
    @Autowired
    private lateinit var recommendationRepository: SongRecommendationRepository

    @Test
    fun `latest published ready query enforces candidate approval and lyric safety gates`() {
        val weekStartDate = LocalDate.of(2026, 6, 22)
        val ready = songWithLyric("Ready", "Artist")
        val unsafe = songWithLyric("Unsafe", "Artist", analyzed = false)
        val rejected = songWithLyric("Rejected", "Artist")
        val readyCandidate = candidate("ready-safe", sourceRank = 1, weekStartDate = weekStartDate)
        val unsafeCandidate = candidate("unsafe-incomplete", sourceRank = 2, weekStartDate = weekStartDate)
        val rejectedCandidate = candidate("rejected", sourceRank = 3, weekStartDate = weekStartDate, status = RecommendationCandidateStatus.REJECTED)
        val readyRecommendation = recommendation(candidate = readyCandidate, songId = ready.song.id!!, lyricId = ready.lyric.id!!)
        recommendation(candidate = unsafeCandidate, songId = unsafe.song.id!!, lyricId = unsafe.lyric.id!!)
        recommendation(candidate = rejectedCandidate, songId = rejected.song.id!!, lyricId = rejected.lyric.id!!)
        entityManager.flush()
        entityManager.clear()

        val result = recommendationRepository.findLatestPublishedReadyRecommendations()

        assertThat(result).extracting<Long> { it.getId() }.containsExactly(readyRecommendation.id)
        assertThat(result.first().getSongId()).isEqualTo(ready.song.id)
    }

    private fun songWithLyric(title: String, artist: String, analyzed: Boolean = true): SongFixture {
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
        return SongFixture(song = song, lyric = lyric)
    }

    private fun candidate(
        sourceSongId: String,
        sourceRank: Int,
        weekStartDate: LocalDate,
        status: RecommendationCandidateStatus = RecommendationCandidateStatus.APPROVED,
    ): SongRecommendationCandidateEntity {
        val candidate = SongRecommendationCandidateEntity(
            source = RecommendationSource.APPLE_MUSIC_RSS,
            sourceSongId = sourceSongId,
            weekStartDate = weekStartDate,
            sourceRank = sourceRank,
            status = status,
            title = sourceSongId,
            artistName = "Artist",
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

    private data class SongFixture(
        val song: SongEntity,
        val lyric: LyricEntity,
    )
}
