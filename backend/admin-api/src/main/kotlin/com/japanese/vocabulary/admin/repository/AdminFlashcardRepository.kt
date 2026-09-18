package com.japanese.vocabulary.admin.repository

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface AdminFlashcardRepository : JpaRepository<FlashcardEntity, Long> {
    fun findByWordIdIn(wordIds: Collection<Long>): List<FlashcardEntity>

    @Query(
        """
        SELECT f.userId AS userId, MAX(f.lastReview) AS lastReviewedAt
        FROM FlashcardEntity f
        WHERE f.userId IN :userIds
        GROUP BY f.userId
        """,
    )
    fun summarizeByUserIds(@Param("userIds") userIds: Collection<Long>): List<AdminUserFlashcardSummaryProjection>
}

interface AdminUserFlashcardSummaryProjection {
    fun getUserId(): Long
    fun getLastReviewedAt(): Instant?
}
