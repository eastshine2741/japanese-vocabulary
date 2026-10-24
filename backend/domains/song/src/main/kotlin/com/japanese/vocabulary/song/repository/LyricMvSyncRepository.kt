package com.japanese.vocabulary.song.repository

import com.japanese.vocabulary.song.entity.LyricMvSyncEntity
import com.japanese.vocabulary.song.entity.LyricMvSyncStatus
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface LyricMvSyncRepository : JpaRepository<LyricMvSyncEntity, Long> {
    fun findByLyricIdAndYoutubeVideoIdAndStatus(lyricId: Long, youtubeVideoId: String, status: LyricMvSyncStatus): LyricMvSyncEntity?

    /**
     * 없으면 넣고, FAILED 면 다시 대기시킨다(MV 가 A→B→A 로 돌아온 경우 등). 키 충돌로 호출 트랜잭션이 죽지 않게 upsert 다.
     * MySQL 은 SET 을 왼쪽부터 적용하므로 status 를 맨 뒤에 둬야 앞의 IF 가 옛 status 를 본다.
     */
    @Modifying
    @Query(
        value = "INSERT INTO lyric_mv_sync (lyric_id, youtube_video_id) VALUES (:lyricId, :videoId) " +
            "ON DUPLICATE KEY UPDATE " +
            "attempt = IF(status = 'FAILED', 0, attempt), " +
            "lease_until = IF(status = 'FAILED', NULL, lease_until), " +
            "error_message = IF(status = 'FAILED', NULL, error_message), " +
            "status = IF(status = 'FAILED', 'PENDING', status)",
        nativeQuery = true,
    )
    fun enqueue(@Param("lyricId") lyricId: Long, @Param("videoId") videoId: String): Int

    /** 대기열에 빠진 곡의 지금 조합을 넣는다. V52 의 backfill 과 같은 식이다. */
    @Modifying
    @Query(
        value = "INSERT IGNORE INTO lyric_mv_sync (lyric_id, youtube_video_id) " +
            "SELECT s.active_lyric_id, SUBSTRING(s.youtube_url, LOCATE('v=', s.youtube_url) + 2, 11) FROM songs s " +
            "WHERE s.active_lyric_id IS NOT NULL AND s.youtube_url REGEXP 'v=[A-Za-z0-9_-]{11}'",
        nativeQuery = true,
    )
    fun enqueueMissingForSongs(): Int

    @Query(
        value = "SELECT id FROM lyric_mv_sync " +
            "WHERE (status = 'PENDING' AND (lease_until IS NULL OR lease_until < :now)) " +
            "OR (status = 'RUNNING' AND lease_until < :now) " +
            "ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED",
        nativeQuery = true,
    )
    fun findNextClaimableIdForUpdate(@Param("now") now: Instant): Long?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM LyricMvSyncEntity s WHERE s.id = :id")
    fun findByIdForUpdate(@Param("id") id: Long): LyricMvSyncEntity?
}
