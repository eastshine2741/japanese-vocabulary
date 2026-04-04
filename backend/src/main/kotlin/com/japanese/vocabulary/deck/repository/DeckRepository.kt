package com.japanese.vocabulary.deck.repository

import com.japanese.vocabulary.deck.entity.DeckEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface DeckRepository : JpaRepository<DeckEntity, Long> {
    fun findByUserIdAndSongId(userId: Long, songId: Long): DeckEntity?
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<DeckEntity>

    @Query(nativeQuery = true, value = """
        SELECT d.song_id AS songId, s.title AS title, s.artist AS artist, s.artwork_url AS artworkUrl,
               COUNT(DISTINCT df.flashcard_id) AS wordCount,
               SUM(CASE WHEN f.due <= NOW() THEN 1 ELSE 0 END) AS dueCount,
               SUM(CASE WHEN f.state = 1 THEN 1 ELSE 0 END) AS masteredCount
        FROM decks d
        JOIN songs s ON s.id = d.song_id
        LEFT JOIN deck_flashcards df ON df.deck_id = d.id
        LEFT JOIN flashcards f ON f.id = df.flashcard_id
        WHERE d.user_id = :userId
        GROUP BY d.id, d.song_id, s.title, s.artist, s.artwork_url, d.created_at
        ORDER BY d.created_at DESC
    """)
    fun findSongDeckSummaries(@Param("userId") userId: Long): List<SongDeckSummaryProjection>

    @Query(nativeQuery = true, value = """
        SELECT COUNT(*) AS wordCount,
               SUM(CASE WHEN f.due <= NOW() THEN 1 ELSE 0 END) AS dueCount,
               SUM(CASE WHEN f.state = 1 THEN 1 ELSE 0 END) AS masteredCount,
               SUM(CASE WHEN (f.state = 0 AND f.last_review IS NOT NULL) OR f.state = 2 THEN 1 ELSE 0 END) AS studyingCount,
               SUM(CASE WHEN f.state = 0 AND f.last_review IS NULL THEN 1 ELSE 0 END) AS newWordCount
        FROM flashcards f
        WHERE f.user_id = :userId
    """)
    fun findAllDeckDetailStats(@Param("userId") userId: Long): DeckDetailStatsProjection

    @Query(nativeQuery = true, value = """
        SELECT COUNT(*) AS wordCount,
               SUM(CASE WHEN f.due <= NOW() THEN 1 ELSE 0 END) AS dueCount,
               SUM(CASE WHEN f.state = 1 THEN 1 ELSE 0 END) AS masteredCount,
               SUM(CASE WHEN (f.state = 0 AND f.last_review IS NOT NULL) OR f.state = 2 THEN 1 ELSE 0 END) AS studyingCount,
               SUM(CASE WHEN f.state = 0 AND f.last_review IS NULL THEN 1 ELSE 0 END) AS newWordCount
        FROM flashcards f
        WHERE f.user_id = :userId
        AND f.id IN (
            SELECT df.flashcard_id FROM deck_flashcards df
            JOIN decks d ON d.id = df.deck_id
            WHERE d.song_id = :songId AND d.user_id = :userId
        )
    """)
    fun findSongDeckDetailStats(@Param("userId") userId: Long, @Param("songId") songId: Long): DeckDetailStatsProjection
}

interface SongDeckSummaryProjection {
    fun getSongId(): Long
    fun getTitle(): String
    fun getArtist(): String
    fun getArtworkUrl(): String?
    fun getWordCount(): Int
    fun getDueCount(): Int
    fun getMasteredCount(): Int
}

interface DeckDetailStatsProjection {
    fun getWordCount(): Int
    fun getDueCount(): Int
    fun getMasteredCount(): Int
    fun getStudyingCount(): Int
    fun getNewWordCount(): Int
}
