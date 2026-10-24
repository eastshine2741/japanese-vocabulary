package com.japanese.vocabulary.admin.repository

import com.japanese.vocabulary.song.entity.LyricMvSyncEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface AdminLyricMvSyncRepository : JpaRepository<LyricMvSyncEntity, Long> {
    /** verdict 는 실행기가 confidence JSON 에 남긴다. 다시 계산한 행이 위로 오도록 updated_at 순이다. */
    @Query(
        value = "SELECT * FROM lyric_mv_sync m " +
            "WHERE (:status IS NULL OR m.status = :status) " +
            "AND (:verdict IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(m.confidence, '\$.verdict')) = :verdict) " +
            "ORDER BY m.updated_at DESC, m.id DESC",
        countQuery = "SELECT COUNT(*) FROM lyric_mv_sync m " +
            "WHERE (:status IS NULL OR m.status = :status) " +
            "AND (:verdict IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(m.confidence, '\$.verdict')) = :verdict)",
        nativeQuery = true,
    )
    fun search(
        @Param("status") status: String?,
        @Param("verdict") verdict: String?,
        pageable: Pageable,
    ): Page<LyricMvSyncEntity>
}
