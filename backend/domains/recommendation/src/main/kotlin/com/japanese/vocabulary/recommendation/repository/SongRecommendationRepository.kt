package com.japanese.vocabulary.recommendation.repository

import com.japanese.vocabulary.recommendation.entity.SongRecommendationEntity
import com.japanese.vocabulary.recommendation.entity.SongRecommendationStatus
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.time.LocalDate

interface SongRecommendationRepository : JpaRepository<SongRecommendationEntity, Long> {
    fun findByCandidateId(candidateId: Long): SongRecommendationEntity?

    fun existsByCandidateId(candidateId: Long): Boolean

    fun findByWeekStartDateOrderByOrderIndexAscCreatedAtAsc(weekStartDate: LocalDate): List<SongRecommendationEntity>

    fun countByStatus(status: SongRecommendationStatus): Long

    @Query("SELECT MAX(r.weekStartDate) FROM SongRecommendationEntity r")
    fun findLatestWeekStartDate(): LocalDate?

    fun findTopByStatusOrderByWeekStartDateDesc(status: SongRecommendationStatus): SongRecommendationEntity?

    fun findByWeekStartDateAndStatusOrderByOrderIndexAscCreatedAtAsc(
        weekStartDate: LocalDate,
        status: SongRecommendationStatus,
    ): List<SongRecommendationEntity>

    @Query(
        value = """
            SELECT
                r.id AS id,
                r.song_id AS songId,
                s.title AS title,
                s.artist AS artist,
                s.artwork_url AS artworkUrl,
                r.week_start_date AS weekStartDate
            FROM song_recommendation r
            JOIN song_recommendation_candidate c ON c.id = r.candidate_id
            JOIN songs s ON s.id = r.song_id
            JOIN lyrics l ON l.id = r.lyric_id
            WHERE r.status = 'PUBLISHED'
              AND r.week_start_date = (
                  SELECT MAX(r2.week_start_date)
                  FROM song_recommendation r2
                  WHERE r2.status = 'PUBLISHED'
              )
              AND c.status = 'APPROVED'
              AND l.song_id = r.song_id
              AND l.analyzed_content IS NOT NULL
            ORDER BY r.order_index ASC, r.created_at ASC
        """,
        nativeQuery = true,
    )
    fun findLatestPublishedReadyRecommendations(): List<PublishedSongRecommendationProjection>
}
