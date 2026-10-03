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

    // Sweeper only. A queue message normally carries the id, so this finds rows whose message was
    // lost (broker restart, publish crash between commit and send) and republishes them.
    @Query(
        "SELECT w.id FROM SongAnalysisWorkEntity w " +
            "WHERE w.status = com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus.PENDING " +
            "AND w.createdAt < :threshold " +
            "ORDER BY w.createdAt ASC"
    )
    fun findStalePendingIds(
        @Param("threshold") threshold: Instant,
        pageable: Pageable,
    ): List<Long>

    // Sweeper only. updatedAt 은 claim 과 단계 기록마다 갱신되므로 "진행이 멈춘 시간" 을 뜻한다.
    // 총 실행 시간이 아니라서 느린 분석을 죽이지 않고, 멈춘 worker 는 다음 sweep 에 걸린다.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
        "SELECT w FROM SongAnalysisWorkEntity w " +
            "WHERE w.status = com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus.RUNNING " +
            "AND w.updatedAt < :threshold " +
            "ORDER BY w.updatedAt ASC"
    )
    fun findStaleRunningForUpdate(
        @Param("threshold") threshold: Instant,
        pageable: Pageable,
    ): List<SongAnalysisWorkEntity>
}
