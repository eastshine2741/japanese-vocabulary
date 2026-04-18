package com.japanese.vocabulary.flashcard.repository

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.Instant

@Repository
interface FlashcardRepository : JpaRepository<FlashcardEntity, Long> {
    fun findByUserIdAndDueLessThanEqual(userId: Long, due: Instant): List<FlashcardEntity>
    fun findByUserId(userId: Long): List<FlashcardEntity>
    fun findByWordId(wordId: Long): FlashcardEntity?
    fun countByUserId(userId: Long): Long
    fun countByUserIdAndState(userId: Long, state: Int): Long
    fun countByUserIdAndDueLessThanEqual(userId: Long, due: Instant): Long
    fun countByUserIdAndLastReviewIsNull(userId: Long): Long
    fun findByUserIdAndWordIdIn(userId: Long, wordIds: List<Long>): List<FlashcardEntity>

    @Query("""
        SELECT f FROM FlashcardEntity f
        WHERE f.userId = :userId AND f.due <= :now
        AND f.id IN (
            SELECT df.flashcardId FROM DeckFlashcardEntity df, DeckEntity d
            WHERE df.deckId = d.id AND d.songId = :songId AND d.userId = :userId
        )
    """)
    fun findDueByUserIdAndSongId(@Param("userId") userId: Long, @Param("songId") songId: Long, @Param("now") now: Instant): List<FlashcardEntity>
}
