package com.japanese.vocabulary.admin.repository

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface AdminSongAnalysisWorkRepository : JpaRepository<SongAnalysisWorkEntity, Long> {
    fun findByStatus(status: SongAnalysisWorkStatus, pageable: Pageable): Page<SongAnalysisWorkEntity>
}
