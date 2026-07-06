package com.japanese.vocabulary.word.repository

import com.japanese.vocabulary.word.entity.SongWordEntity
import org.springframework.data.jpa.repository.JpaRepository

interface SongWordRepository : JpaRepository<SongWordEntity, Long> {
    fun findByWordId(wordId: Long): List<SongWordEntity>
    fun findBySongId(songId: Long): List<SongWordEntity>
    fun findByWordIdIn(wordIds: List<Long>): List<SongWordEntity>
    fun findBySongIdAndWordIdIn(songId: Long, wordIds: Collection<Long>): List<SongWordEntity>
    fun existsByWordIdAndSongIdAndLyricLine(wordId: Long, songId: Long, lyricLine: String?): Boolean
    fun deleteByWordId(wordId: Long)
}
