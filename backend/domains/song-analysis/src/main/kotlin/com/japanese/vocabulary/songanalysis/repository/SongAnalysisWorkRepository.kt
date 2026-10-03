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

    /**
     * 활성 작업 조회와 중복 차단을 겸한다. 한 곡에 활성 작업이 하나라는 불변식이 이 쿼리에 달려 있다.
     *
     * 활성 행이 없으면 InnoDB 가 `(raw_title, raw_artist)` 인덱스에서 그 키가 들어갈 틈에 갭 락을
     * 잡고, 같은 곡을 동시에 요청한 쪽의 insert 가 그 락에 걸린다. 종료된 행은 status 조건에서
     * 빠지므로 키를 따로 비우는 단계가 없다.
     *
     * 두 가지 전제가 깨지면 보호가 조용히 사라진다:
     * - `idx_song_analysis_work_raw_song` (V33). 없으면 풀스캔하며 스캔한 행을 다 잠가서 무관한
     *   곡까지 직렬화된다.
     * - REPEATABLE READ. READ COMMITTED 에서는 InnoDB 가 갭 락을 걸지 않아 중복이 그냥 통과한다.
     *
     * 반환이 List 인 건, 관리자가 곡 제목을 수정한 뒤 생긴 행처럼 이 키로 막히지 않는 경우에도
     * 예외로 터지지 않게 하려는 것이다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
        "SELECT w FROM SongAnalysisWorkEntity w " +
            "WHERE w.rawTitle = :title AND w.rawArtist = :artist " +
            "AND w.status IN (" +
            "com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus.PENDING, " +
            "com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus.RUNNING) " +
            "ORDER BY w.createdAt ASC"
    )
    fun findActiveByRawSongForUpdate(
        @Param("title") title: String,
        @Param("artist") artist: String,
    ): List<SongAnalysisWorkEntity>

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
