package com.japanese.vocabulary.song.repository

import com.japanese.vocabulary.song.entity.LyricEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface LyricRepository : JpaRepository<LyricEntity, Long> {
    @Deprecated("Use findActiveBySongId for active reads or findAllBySongIdOrderByCreatedAtDesc for history.")
    fun findBySongId(songId: Long): LyricEntity?

    @Query("SELECT l FROM LyricEntity l, SongEntity s WHERE s.id = :songId AND l.id = s.activeLyricId")
    fun findActiveBySongId(@Param("songId") songId: Long): LyricEntity?

    fun findAllBySongIdOrderByCreatedAtDesc(songId: Long): List<LyricEntity>
}
