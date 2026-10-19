package com.japanese.vocabulary.flashcard.service

import com.japanese.vocabulary.featureflag.FeatureFlagKeys
import com.japanese.vocabulary.featureflag.service.FeatureFlags
import com.japanese.vocabulary.flashcard.dto.ReviewResponse
import com.japanese.vocabulary.rewardcard.service.RewardCardAchievementService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** rating 과 카드 달성을 한 트랜잭션에 묶는다. 달성 순번이 rating 과 함께 커밋되거나 함께 롤백된다. */
@Service
class FlashcardReviewService(
    private val flashcardService: FlashcardService,
    private val rewardCardAchievementService: RewardCardAchievementService,
    private val featureFlags: FeatureFlags,
) {
    @Transactional
    fun review(userId: Long, flashcardId: Long, rating: Int): ReviewResponse {
        val result = flashcardService.reviewCard(userId, flashcardId, rating)
        // 꺼져 있으면 구클라 rating 경로에 달성 조회·쓰기를 싣지 않는다. 그 사이 닿은 등급은 켠 뒤 batch 채우기가 준다.
        val rewardCards = if (featureFlags.isOn(FeatureFlagKeys.REWARD_CARD)) {
            rewardCardAchievementService.onReviewed(userId, result.wordId)
        } else {
            emptyList()
        }
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
