package com.japanese.vocabulary.song.repository

import com.japanese.vocabulary.song.entity.KoreanLyricEntity
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface KoreanLyricRepository : JpaRepository<KoreanLyricEntity, Long> {
    fun findBySongId(songId: Long): KoreanLyricEntity?

    @Query("SELECT k FROM KoreanLyricEntity k WHERE k.status IN :statuses ORDER BY k.createdAt ASC")
    fun findNextForTranslation(statuses: List<KoreanLyricStatus>, pageable: Pageable): List<KoreanLyricEntity>
}
