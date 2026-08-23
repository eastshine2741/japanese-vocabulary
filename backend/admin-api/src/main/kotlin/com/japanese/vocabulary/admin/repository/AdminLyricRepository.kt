package com.japanese.vocabulary.admin.repository

import com.japanese.vocabulary.song.entity.LyricEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface AdminLyricRepository : JpaRepository<LyricEntity, Long> {
    @Deprecated("Use findActiveBySongId for active reads or findAllBySongIdOrderByCreatedAtDesc for history.")
    fun findBySongId(songId: Long): LyricEntity?

    @Query("SELECT l FROM LyricEntity l, SongEntity s WHERE s.id = :songId AND l.id = s.activeLyricId")
    fun findActiveBySongId(@Param("songId") songId: Long): LyricEntity?

    @Query("SELECT l FROM LyricEntity l, SongEntity s WHERE s.id IN :songIds AND l.id = s.activeLyricId")
    fun findActiveBySongIdIn(@Param("songIds") songIds: Collection<Long>): List<LyricEntity>

    fun findAllBySongIdOrderByCreatedAtDesc(songId: Long): List<LyricEntity>
}
