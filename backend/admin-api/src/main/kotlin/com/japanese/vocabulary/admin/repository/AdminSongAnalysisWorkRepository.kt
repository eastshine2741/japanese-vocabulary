package com.japanese.vocabulary.admin.repository

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import org.springframework.data.jpa.repository.JpaRepository

interface AdminSongAnalysisWorkRepository : JpaRepository<SongAnalysisWorkEntity, Long> {
    fun findFirstByLyricIdOrderByCreatedAtDesc(lyricId: Long): SongAnalysisWorkEntity?

    fun findByLyricIdInOrderByCreatedAtDesc(lyricIds: Collection<Long>): List<SongAnalysisWorkEntity>
}
