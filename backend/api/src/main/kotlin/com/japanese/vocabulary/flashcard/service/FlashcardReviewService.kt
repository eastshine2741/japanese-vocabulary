package com.japanese.vocabulary.flashcard.service

import com.japanese.vocabulary.flashcard.dto.ReviewResponse
import com.japanese.vocabulary.rewardcard.service.RewardCardAchievementService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** rating 과 카드 달성을 한 트랜잭션에 묶는다. 달성 순번이 rating 과 함께 커밋되거나 함께 롤백된다. */
@Service
class FlashcardReviewService(
    private val flashcardService: FlashcardService,
    private val rewardCardAchievementService: RewardCardAchievementService,
) {
    @Transactional
    fun review(userId: Long, flashcardId: Long, rating: Int): ReviewResponse {
        val result = flashcardService.reviewCard(userId, flashcardId, rating)
        val rewardCards = rewardCardAchievementService.onReviewed(userId, result.wordId)
        return ReviewResponse(
            id = result.id,
            state = result.state,
            due = result.due,
            stability = result.stability,
            difficulty = result.difficulty,
            memory = result.memory,
            rewardCards = rewardCards,
        )
    }
}
