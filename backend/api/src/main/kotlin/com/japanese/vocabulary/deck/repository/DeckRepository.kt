package com.japanese.vocabulary.deck.repository

import com.japanese.vocabulary.deck.entity.DeckEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface DeckRepository : JpaRepository<DeckEntity, Long> {
    fun findByUserIdAndSongId(userId: Long, songId: Long): DeckEntity?

    fun findByUserIdOrderByCreatedAtDesc(userId: Long, pageable: Pageable): List<DeckEntity>

    fun findByUserIdAndIdLessThanOrderByCreatedAtDesc(
        userId: Long,
        id: Long,
        pageable: Pageable,
    ): List<DeckEntity>

    // COALESCE: SUM over zero rows returns NULL, which fails projection mapping to non-null Int.
    @Query(nativeQuery = true, value = """
        SELECT df.deck_id AS deckId,
               COUNT(DISTINCT df.flashcard_id) AS wordCount,
               COALESCE(SUM(CASE WHEN f.due <= NOW() THEN 1 ELSE 0 END), 0) AS dueCount,
               COALESCE(SUM(CASE WHEN f.state = 1 THEN 1 ELSE 0 END), 0) AS masteredCount
        FROM deck_flashcards df
        LEFT JOIN flashcards f ON f.id = df.flashcard_id
        WHERE df.deck_id IN (:deckIds)
        GROUP BY df.deck_id
    """)
    fun findDeckStats(@Param("deckIds") deckIds: List<Long>): List<DeckStatsProjection>

    @Query(nativeQuery = true, value = """
        SELECT COUNT(*) AS wordCount,
               COALESCE(SUM(CASE WHEN f.due <= NOW() THEN 1 ELSE 0 END), 0) AS dueCount,
               COALESCE(SUM(CASE WHEN f.state = 1 THEN 1 ELSE 0 END), 0) AS masteredCount,
               COALESCE(SUM(CASE WHEN (f.state = 0 AND f.last_review IS NOT NULL) OR f.state = 2 THEN 1 ELSE 0 END), 0) AS studyingCount,
               COALESCE(SUM(CASE WHEN f.state = 0 AND f.last_review IS NULL THEN 1 ELSE 0 END), 0) AS newWordCount
        FROM flashcards f
        WHERE f.user_id = :userId
    """)
    fun findAllDeckDetailStats(@Param("userId") userId: Long): DeckDetailStatsProjection

    @Query(nativeQuery = true, value = """
        SELECT COUNT(*) AS wordCount,
               COALESCE(SUM(CASE WHEN f.due <= NOW() THEN 1 ELSE 0 END), 0) AS dueCount,
               COALESCE(SUM(CASE WHEN f.state = 1 THEN 1 ELSE 0 END), 0) AS masteredCount,
               COALESCE(SUM(CASE WHEN (f.state = 0 AND f.last_review IS NOT NULL) OR f.state = 2 THEN 1 ELSE 0 END), 0) AS studyingCount,
               COALESCE(SUM(CASE WHEN f.state = 0 AND f.last_review IS NULL THEN 1 ELSE 0 END), 0) AS newWordCount
        FROM flashcards f
        WHERE f.user_id = :userId
        AND f.id IN (
            SELECT df.flashcard_id FROM deck_flashcards df
            WHERE df.deck_id = :deckId
        )
    """)
    fun findDeckDetailStats(@Param("deckId") deckId: Long, @Param("userId") userId: Long): DeckDetailStatsProjection
}

interface DeckStatsProjection {
    fun getDeckId(): Long
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
