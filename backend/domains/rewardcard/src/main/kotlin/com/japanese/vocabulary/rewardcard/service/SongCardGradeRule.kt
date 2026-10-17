package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.flashcard.model.FlashcardMemory
import com.japanese.vocabulary.rewardcard.model.SongCardGrade

/**
 * 곡 상세 `완곡까지 3단계` 의 단계별 tier 단어 카드로 곡 카드 등급을 정한다. 단계는 앞에서부터 끝낸 수만 센다(남음 0 = 끝).
 * 마스터는 완곡 뒤, tier 단어의 90% 가 장기기억일 때다 — '전부'는 망각 때문에 곡이 길수록 닿기 어렵다.
 */
object SongCardGradeRule {
    const val MASTER_PERCENT = 90

    /** [tiers] 는 단계 순서다. 단어마다 유저의 카드(없으면 null)를 둔다. */
    fun of(tiers: List<List<FlashcardEntity?>>, longTermDays: Double): SongCardGrade {
        val completed = tiers.takeWhile { tier -> tier.all { FlashcardMemory.of(it, longTermDays) != FlashcardMemory.REMAINING } }.size
        if (completed < tiers.size) return SongCardGrade.ofCompletedTiers(completed)
        val all = tiers.flatten()
        val longTerm = all.count { FlashcardMemory.of(it, longTermDays) == FlashcardMemory.LONG_TERM }
        return if (all.isNotEmpty() && longTerm * 100 >= all.size * MASTER_PERCENT) SongCardGrade.MASTER else SongCardGrade.GOLD
    }
}
