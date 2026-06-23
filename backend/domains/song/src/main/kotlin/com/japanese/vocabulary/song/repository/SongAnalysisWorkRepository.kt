package com.japanese.vocabulary.song.repository

import com.japanese.vocabulary.song.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.song.entity.SongAnalysisWorkStatus
import jakarta.persistence.LockModeType
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.Instant

@Repository
interface SongAnalysisWorkRepository : JpaRepository<SongAnalysisWorkEntity, Long> {
    fun findByActiveDedupKey(activeDedupKey: String): SongAnalysisWorkEntity?

    fun countByStatus(status: SongAnalysisWorkStatus): Long

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM SongAnalysisWorkEntity w WHERE w.id = :id")
    fun findByIdForUpdate(@Param("id") id: Long): SongAnalysisWorkEntity?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
        "SELECT w FROM SongAnalysisWorkEntity w " +
            "WHERE w.status = com.japanese.vocabulary.song.entity.SongAnalysisWorkStatus.PENDING " +
            "ORDER BY w.createdAt ASC"
    )
    fun findClaimableForUpdate(
        pageable: Pageable,
    ): List<SongAnalysisWorkEntity>

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
        "SELECT w FROM SongAnalysisWorkEntity w " +
            "WHERE w.status = com.japanese.vocabulary.song.entity.SongAnalysisWorkStatus.RUNNING " +
            "AND w.lockedUntil < :now " +
            "ORDER BY w.lockedUntil ASC"
    )
    fun findExpiredRunningForUpdate(
        @Param("now") now: Instant,
        pageable: Pageable,
    ): List<SongAnalysisWorkEntity>
}
