package com.japanese.vocabulary.admin.repository

import com.japanese.vocabulary.song.entity.SongEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface AdminSongRepository : JpaRepository<SongEntity, Long> {
    fun findByTitleContainingIgnoreCaseOrArtistContainingIgnoreCase(
        title: String,
        artist: String,
        pageable: Pageable,
    ): Page<SongEntity>
}
