package com.japanese.vocabulary.admin.repository

import com.japanese.vocabulary.song.entity.LyricEntity
import org.springframework.data.jpa.repository.JpaRepository

interface AdminLyricRepository : JpaRepository<LyricEntity, Long> {
    fun findBySongId(songId: Long): LyricEntity?
}
