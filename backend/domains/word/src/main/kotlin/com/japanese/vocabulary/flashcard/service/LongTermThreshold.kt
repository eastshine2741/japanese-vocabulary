package com.japanese.vocabulary.flashcard.service

import com.japanese.vocabulary.featureflag.FeatureFlagKeys
import com.japanese.vocabulary.featureflag.service.FeatureFlags
import com.japanese.vocabulary.flashcard.model.FlashcardMemory
import org.springframework.stereotype.Component

/** 장기기억 기준 일수. 14일은 보상 카드와 함께 나가고, 그 전엔 구클라가 보던 7일을 그대로 쓴다. */
@Component
class LongTermThreshold(private val featureFlags: FeatureFlags) {
    fun days(): Double =
        if (featureFlags.isOn(FeatureFlagKeys.REWARD_CARD)) FlashcardMemory.LONG_TERM_STABILITY_DAYS
        else FlashcardMemory.LEGACY_LONG_TERM_STABILITY_DAYS
}
