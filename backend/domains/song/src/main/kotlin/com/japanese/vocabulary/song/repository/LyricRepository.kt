package com.japanese.vocabulary.song.repository

import com.japanese.vocabulary.song.entity.LyricEntity
import org.springframework.data.jpa.repository.JpaRepository

interface LyricRepository : JpaRepository<LyricEntity, Long> {
    fun findBySongId(songId: Long): LyricEntity?
}
