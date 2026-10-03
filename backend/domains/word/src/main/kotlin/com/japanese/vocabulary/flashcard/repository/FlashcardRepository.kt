package com.japanese.vocabulary.flashcard.repository

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface FlashcardRepository : JpaRepository<FlashcardEntity, Long> {
    fun findByUserIdAndDueLessThanEqualOrderByDueAscIdAsc(userId: Long, due: Instant, pageable: Pageable): List<FlashcardEntity>
    fun findFirstByUserIdAndDueGreaterThanOrderByDueAscIdAsc(userId: Long, due: Instant): FlashcardEntity?
    fun findByUserId(userId: Long): List<FlashcardEntity>
    fun findByWordId(wordId: Long): FlashcardEntity?
    fun findByUserIdAndWordIdIn(userId: Long, wordIds: Collection<Long>): List<FlashcardEntity>
    fun countByUserId(userId: Long): Long
    fun countByUserIdAndState(userId: Long, state: Int): Long
    fun countByUserIdAndDueLessThanEqual(userId: Long, due: Instant): Long
    fun countByUserIdAndLastReviewIsNull(userId: Long): Long

    /** 장기기억 카드 수. 판정은 [com.japanese.vocabulary.flashcard.model.FlashcardMemory] 와 같아야 한다. */
    fun countByUserIdAndLastReviewIsNotNullAndStabilityGreaterThanEqual(userId: Long, stability: Double): Long

    @Modifying(flushAutomatically = true)
    @Query(
        value = """
            INSERT INTO flashcards
                (word_id, user_id, due, stability, difficulty, state, fsrs_card_json)
            VALUES
                (:wordId, :userId, :due, :stability, :difficulty, :state, :fsrsCardJson)
            ON DUPLICATE KEY UPDATE word_id = VALUES(word_id)
        """,
        nativeQuery = true,
    )
    fun insertIfAbsent(
        @Param("wordId") wordId: Long,
        @Param("userId") userId: Long,
        @Param("due") due: Instant,
        @Param("stability") stability: Double,
        @Param("difficulty") difficulty: Double,
        @Param("state") state: Int,
        @Param("fsrsCardJson") fsrsCardJson: String,
    ): Int
}
