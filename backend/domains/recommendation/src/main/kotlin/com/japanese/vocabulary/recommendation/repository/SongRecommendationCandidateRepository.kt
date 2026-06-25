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
        "SELECT c FROM SongRecommendationCandidateEntity c " +
            "WHERE c.status = com.japanese.vocabulary.recommendation.entity.RecommendationCandidateStatus.APPROVED " +
            "AND c.songAnalysisWorkId IS NULL " +
            "ORDER BY c.weekStartDate DESC, c.sourceRank ASC, c.id ASC"
    )
    fun findApprovedAwaitingAnalysis(pageable: Pageable): List<SongRecommendationCandidateEntity>

    @Query(
        value = """
            SELECT c.*
            FROM song_recommendation_candidate c
            JOIN song_analysis_work w ON w.id = c.song_analysis_work_id
            JOIN lyrics l ON l.id = w.lyric_id
            WHERE c.status = 'APPROVED'
              AND w.status = 'COMPLETED'
              AND w.song_id IS NOT NULL
              AND w.lyric_id IS NOT NULL
              AND w.player_ready_at IS NOT NULL
              AND l.song_id = w.song_id
              AND l.analyzed_content IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM song_recommendation r WHERE r.candidate_id = c.id
              )
            ORDER BY c.week_start_date DESC, c.source_rank ASC, c.id ASC
        """,
        nativeQuery = true,
    )
    fun findApprovedAwaitingRecommendation(pageable: Pageable): List<SongRecommendationCandidateEntity>

    fun countByStatus(@Param("status") status: RecommendationCandidateStatus): Long
}
