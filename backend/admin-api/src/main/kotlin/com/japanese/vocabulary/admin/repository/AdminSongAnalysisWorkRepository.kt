package com.japanese.vocabulary.admin.repository

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import jakarta.persistence.LockModeType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface AdminSongAnalysisWorkRepository : JpaRepository<SongAnalysisWorkEntity, Long> {
    fun findByStatus(status: SongAnalysisWorkStatus, pageable: Pageable): Page<SongAnalysisWorkEntity>

    /**
     * `SongAnalysisWorkRepository.findActiveByRawSongForUpdate` 와 같은 쿼리다. 관리자 재분석도
     * 유저 요청과 같은 갭 락에 걸려야 둘이 서로를 막으므로, 잠그는 대상이 같아야 한다.
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

    fun findFirstBySongIdAndStatusInOrderByCreatedAtAsc(
        songId: Long,
        statuses: Collection<SongAnalysisWorkStatus>,
    ): SongAnalysisWorkEntity?

    fun findBySongIdOrderByCreatedAtDesc(songId: Long, pageable: Pageable): List<SongAnalysisWorkEntity>
}
