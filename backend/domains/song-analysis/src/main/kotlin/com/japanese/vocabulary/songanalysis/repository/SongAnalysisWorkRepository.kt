package com.japanese.vocabulary.songanalysis.repository

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import jakarta.persistence.LockModeType
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface SongAnalysisWorkRepository : JpaRepository<SongAnalysisWorkEntity, Long> {
    fun findByActiveDedupKey(activeDedupKey: String): SongAnalysisWorkEntity?

    fun countByStatus(status: SongAnalysisWorkStatus): Long

    fun findBySongIdAndStatusInOrderByCreatedAtAsc(
        songId: Long,
        statuses: Collection<SongAnalysisWorkStatus>,
    ): List<SongAnalysisWorkEntity>

    fun findBySongIdOrderByCreatedAtDesc(songId: Long): List<SongAnalysisWorkEntity>

    // Select only the id: the following locking read must see the latest committed status,
    // not an entity cached by an earlier non-locking read in this transaction.
    @Query("""
        SELECT w.id FROM SongAnalysisWorkEntity w
        WHERE w.songId = :songId AND w.lyricId = :lyricId
        ORDER BY w.createdAt DESC, w.id DESC
    """)
    fun findLatestIdsForLyric(
        @Param("songId") songId: Long,
        @Param("lyricId") lyricId: Long,
        pageable: Pageable,
    ): List<Long>

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM SongAnalysisWorkEntity w WHERE w.id = :id")
    fun findByIdForUpdate(@Param("id") id: Long): SongAnalysisWorkEntity?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
        "SELECT w FROM SongAnalysisWorkEntity w " +
            "WHERE w.status = com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus.PENDING " +
            "ORDER BY w.createdAt ASC"
    )
    fun findClaimableForUpdate(
        pageable: Pageable,
    ): List<SongAnalysisWorkEntity>

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
        "SELECT w FROM SongAnalysisWorkEntity w " +
            "WHERE w.status = com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus.RUNNING " +
            "AND w.lockedUntil < :now " +
            "ORDER BY w.lockedUntil ASC"
    )
    fun findExpiredRunningForUpdate(
        @Param("now") now: Instant,
        pageable: Pageable,
    ): List<SongAnalysisWorkEntity>
}
