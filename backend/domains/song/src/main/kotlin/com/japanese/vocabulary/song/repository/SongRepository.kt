package com.japanese.vocabulary.song.repository

import com.japanese.vocabulary.song.entity.SongEntity
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface SongRepository : JpaRepository<SongEntity, Long> {
    fun findByArtistAndTitle(artist: String, title: String): SongEntity?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM SongEntity s WHERE s.id = :id")
    fun findByIdForUpdate(@Param("id") id: Long): SongEntity?
}
