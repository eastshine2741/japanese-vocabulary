package com.japanese.vocabulary.song.repository

import com.japanese.vocabulary.song.entity.SongEntity
import org.springframework.data.jpa.repository.JpaRepository

interface SongRepository : JpaRepository<SongEntity, Long> {
    fun findByArtistAndTitle(artist: String, title: String): SongEntity?
}
