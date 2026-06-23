package com.japanese.vocabulary.admin.repository

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface AdminLyricRepository : JpaRepository<LyricEntity, Long> {
    fun findBySongId(songId: Long): LyricEntity?

    @Query(
        value = """
            SELECT l FROM LyricEntity l
            WHERE EXISTS (
                SELECT 1 FROM SongAnalysisWorkEntity w
                WHERE w.lyricId = l.id
                AND w.status = :status
            )
        """,
        countQuery = """
            SELECT COUNT(l) FROM LyricEntity l
            WHERE EXISTS (
                SELECT 1 FROM SongAnalysisWorkEntity w
                WHERE w.lyricId = l.id
                AND w.status = :status
            )
        """,
    )
    fun findByAnalysisWorkStatus(
        @Param("status") status: SongAnalysisWorkStatus,
        pageable: Pageable,
    ): Page<LyricEntity>
}
