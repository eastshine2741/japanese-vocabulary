package com.japanese.vocabulary.word.repository

import com.japanese.vocabulary.word.entity.SongWordEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface SongWordRepository : JpaRepository<SongWordEntity, Long> {
    fun findByWordId(wordId: Long): List<SongWordEntity>
    fun findBySongId(songId: Long): List<SongWordEntity>
}
