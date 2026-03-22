package com.japanese.vocabulary.song.repository

import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.entity.LyricEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface LyricRepository : JpaRepository<LyricEntity, Long> {
    fun findBySongId(songId: Long): LyricEntity?

    @Query("SELECT l FROM LyricEntity l WHERE l.status IN :statuses ORDER BY l.createdAt ASC")
    fun findNextForTranslation(statuses: List<KoreanLyricStatus>, pageable: Pageable): List<LyricEntity>
}
