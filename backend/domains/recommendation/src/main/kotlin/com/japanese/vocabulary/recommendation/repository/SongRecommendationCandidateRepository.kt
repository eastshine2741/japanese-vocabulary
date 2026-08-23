package com.japanese.vocabulary.recommendation.repository

import com.japanese.vocabulary.recommendation.entity.RecommendationCandidateStatus
import com.japanese.vocabulary.recommendation.entity.RecommendationSource
import com.japanese.vocabulary.recommendation.entity.SongRecommendationCandidateEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDate

interface SongRecommendationCandidateRepository : JpaRepository<SongRecommendationCandidateEntity, Long> {
    fun findBySourceAndWeekStartDateAndSourceSongId(
        source: RecommendationSource,
        weekStartDate: LocalDate,
        sourceSongId: String,
    ): SongRecommendationCandidateEntity?

    @Query(
        value = """
            SELECT c.*
            FROM song_recommendation_candidate c
            WHERE c.status = 'APPROVED'
              AND c.week_start_date = :weekStartDate
              AND NOT EXISTS (
                  SELECT 1 FROM song_recommendation r WHERE r.candidate_id = c.id
              )
            ORDER BY c.source_rank ASC, c.id ASC
        """,
        nativeQuery = true,
    )
    fun findApprovedWithoutRecommendationForWeek(
        @Param("weekStartDate") weekStartDate: LocalDate,
        pageable: Pageable,
    ): List<SongRecommendationCandidateEntity>

    fun countByStatus(@Param("status") status: RecommendationCandidateStatus): Long

    @Query("SELECT MAX(c.weekStartDate) FROM SongRecommendationCandidateEntity c")
    fun findLatestWeekStartDate(): LocalDate?

    @Query(
        "SELECT DISTINCT c.weekStartDate FROM SongRecommendationCandidateEntity c " +
            "ORDER BY c.weekStartDate DESC"
    )
    fun findCollectedWeekStartDates(pageable: Pageable): List<LocalDate>

    @Query(
        "SELECT c FROM SongRecommendationCandidateEntity c " +
            "WHERE c.weekStartDate = :weekStartDate " +
            "AND (:status IS NULL OR c.status = :status) " +
            "ORDER BY c.sourceRank ASC, c.id ASC"
    )
    fun findCandidatesForWeek(
        @Param("weekStartDate") weekStartDate: LocalDate,
        @Param("status") status: RecommendationCandidateStatus?,
        pageable: Pageable,
    ): List<SongRecommendationCandidateEntity>
}
