package com.japanese.vocabulary.flashcard.model

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import java.time.Instant

/**
 * 카드 하나의 기억 상태. flashcard 는 유저 기준이라 다른 곡에서 익힌 단어도 여기서 같은 칸으로 센다.
 *
 * FSRS stability 는 retrievability 가 0.9 로 떨어지는 경과일수라 "N일 뒤 회상 확률 90% 이상" 은
 * `stability >= N` 으로 판정된다. FSRS state(REVIEW 여부)와는 기준이 다르다.
 * N 은 [com.japanese.vocabulary.flashcard.service.LongTermThreshold] 가 정한다.
 */
enum class FlashcardMemory {
    LONG_TERM, SHORT_TERM, REMAINING;

    companion object {
        const val LONG_TERM_STABILITY_DAYS = 14.0
        const val LEGACY_LONG_TERM_STABILITY_DAYS = 7.0

        fun of(card: FlashcardEntity?, longTermDays: Double): FlashcardMemory = when {
            card?.lastReview == null -> REMAINING
            card.stability >= longTermDays -> LONG_TERM
            else -> SHORT_TERM
        }

        /** 리뷰 직후의 칸. 리뷰를 마친 카드는 이력이 생기므로 REMAINING 일 수 없다. */
        fun ofReviewed(stability: Double, longTermDays: Double): FlashcardMemory =
            if (stability >= longTermDays) LONG_TERM else SHORT_TERM

        /** 지금 학습할 단어 — 한 번도 리뷰하지 않았거나 due 가 지났다. */
        fun isDue(card: FlashcardEntity?, now: Instant): Boolean =
            card?.lastReview == null || card.due <= now
    }
}
