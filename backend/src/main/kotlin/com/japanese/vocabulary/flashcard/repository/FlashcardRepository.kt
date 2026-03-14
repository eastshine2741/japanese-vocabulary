package com.japanese.vocabulary.flashcard.repository

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import org.springframework.data.jpa.repository.JpaRepository
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
}
