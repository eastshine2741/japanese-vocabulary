package com.japanese.vocabulary.song.repository

import com.japanese.vocabulary.song.entity.SongReportEntity
import com.japanese.vocabulary.song.entity.SongReportStatus
import jakarta.persistence.LockModeType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface SongReportRepository : JpaRepository<SongReportEntity, Long> {
    fun findByStatus(status: SongReportStatus, pageable: Pageable): Page<SongReportEntity>

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM SongReportEntity r WHERE r.id = :id")
    fun findByIdForUpdate(@Param("id") id: Long): SongReportEntity?

    @Query(
        """
        SELECT r.userId FROM SongReportEntity r
        WHERE r.songId = :songId AND r.status = com.japanese.vocabulary.song.entity.SongReportStatus.APPROVED
        GROUP BY r.userId
        ORDER BY MIN(r.reviewedAt) ASC, r.userId ASC
        """,
    )
    fun findContributorUserIds(@Param("songId") songId: Long): List<Long>
}
