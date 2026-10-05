package com.japanese.vocabulary.recommendation.repository

import com.japanese.vocabulary.recommendation.dto.RecommendedSongDto
import com.japanese.vocabulary.recommendation.entity.RecommendedSongEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface RecommendedSongRepository : JpaRepository<RecommendedSongEntity, Long> {
    fun existsBySongId(songId: Long): Boolean

    @Query("SELECT MAX(r.orderIndex) FROM RecommendedSongEntity r")
    fun findMaxOrderIndex(): Int?

    @Query(
        """
        SELECT new com.japanese.vocabulary.recommendation.dto.RecommendedSongDto(
            r.id, r.songId, s.title, s.artist, s.artworkUrl, r.orderIndex, r.createdAt
        )
        FROM RecommendedSongEntity r
        JOIN SongEntity s ON s.id = r.songId
        ORDER BY r.orderIndex ASC, r.id ASC
        """
    )
    fun findAllWithSong(): List<RecommendedSongDto>
}
