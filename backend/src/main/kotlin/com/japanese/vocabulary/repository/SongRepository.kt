package com.japanese.vocabulary.repository

import com.japanese.vocabulary.entity.SongEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface SongRepository : JpaRepository<SongEntity, Long> {
    fun findByArtistAndTitle(artist: String, title: String): SongEntity?
}
