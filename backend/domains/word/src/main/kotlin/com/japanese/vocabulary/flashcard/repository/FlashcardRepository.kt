package com.japanese.vocabulary.flashcard.repository

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.domain.Pageable
import java.time.Instant

interface FlashcardRepository : JpaRepository<FlashcardEntity, Long> {
    fun findByUserIdAndDueLessThanEqual(userId: Long, due: Instant): List<FlashcardEntity>
    fun findByUserIdAndDueLessThanEqualOrderByDueAscIdAsc(userId: Long, due: Instant, pageable: Pageable): List<FlashcardEntity>
    fun findFirstByUserIdAndDueGreaterThanOrderByDueAscIdAsc(userId: Long, due: Instant): FlashcardEntity?
    fun findByUserIdAndDueBetweenAndLastReviewIsNotNull(userId: Long, since: Instant, now: Instant): List<FlashcardEntity>
    fun findByUserId(userId: Long): List<FlashcardEntity>
    fun findByWordId(wordId: Long): FlashcardEntity?
    fun countByUserId(userId: Long): Long
    fun countByUserIdAndState(userId: Long, state: Int): Long
    fun countByUserIdAndDueLessThanEqual(userId: Long, due: Instant): Long
    fun countByUserIdAndLastReviewIsNull(userId: Long): Long
}
