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
               ROUND(AVG(CASE WHEN f.state != 0 AND f.last_review IS NOT NULL THEN
                   POW(1 + (19.0/81.0) * (TIMESTAMPDIFF(SECOND, f.last_review, NOW()) / 86400.0 / f.stability), -0.5)
               END), 2) AS avgRetrievability
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
        SELECT COUNT(DISTINCT f.id) AS wordCount,
               ROUND(AVG(CASE WHEN f.state != 0 AND f.last_review IS NOT NULL THEN
                   POW(1 + (19.0/81.0) * (TIMESTAMPDIFF(SECOND, f.last_review, NOW()) / 86400.0 / f.stability), -0.5)
               END), 2) AS avgRetrievability
        FROM flashcards f
        WHERE f.user_id = :userId
    """)
    fun findAllDeckStats(@Param("userId") userId: Long): DeckStatsProjection

    @Query(nativeQuery = true, value = """
        SELECT COUNT(*) AS wordCount,
               SUM(CASE WHEN f.due <= NOW() THEN 1 ELSE 0 END) AS dueCount,
               SUM(CASE WHEN f.state = 0 THEN 1 ELSE 0 END) AS newCount,
               SUM(CASE WHEN f.state = 1 THEN 1 ELSE 0 END) AS learningCount,
               SUM(CASE WHEN f.state = 2 THEN 1 ELSE 0 END) AS reviewCount,
               SUM(CASE WHEN f.state = 3 THEN 1 ELSE 0 END) AS relearningCount,
               ROUND(AVG(CASE WHEN f.state != 0 AND f.last_review IS NOT NULL THEN
                   POW(1 + (19.0/81.0) * (TIMESTAMPDIFF(SECOND, f.last_review, NOW()) / 86400.0 / f.stability), -0.5)
               END), 2) AS avgRetrievability
        FROM flashcards f
        WHERE f.user_id = :userId
    """)
    fun findAllDeckDetailStats(@Param("userId") userId: Long): DeckDetailStatsProjection

    @Query(nativeQuery = true, value = """
        SELECT COUNT(*) AS wordCount,
               SUM(CASE WHEN f.due <= NOW() THEN 1 ELSE 0 END) AS dueCount,
               SUM(CASE WHEN f.state = 0 THEN 1 ELSE 0 END) AS newCount,
               SUM(CASE WHEN f.state = 1 THEN 1 ELSE 0 END) AS learningCount,
               SUM(CASE WHEN f.state = 2 THEN 1 ELSE 0 END) AS reviewCount,
               SUM(CASE WHEN f.state = 3 THEN 1 ELSE 0 END) AS relearningCount,
               ROUND(AVG(CASE WHEN f.state != 0 AND f.last_review IS NOT NULL THEN
                   POW(1 + (19.0/81.0) * (TIMESTAMPDIFF(SECOND, f.last_review, NOW()) / 86400.0 / f.stability), -0.5)
               END), 2) AS avgRetrievability
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
    fun getAvgRetrievability(): Double?
}

interface DeckStatsProjection {
    fun getWordCount(): Int
    fun getAvgRetrievability(): Double?
}

interface DeckDetailStatsProjection {
    fun getWordCount(): Int
    fun getDueCount(): Int
    fun getNewCount(): Int
    fun getLearningCount(): Int
    fun getReviewCount(): Int
    fun getRelearningCount(): Int
    fun getAvgRetrievability(): Double?
}
