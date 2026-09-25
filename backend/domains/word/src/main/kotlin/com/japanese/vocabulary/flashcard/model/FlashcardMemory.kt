package com.japanese.vocabulary.flashcard.model

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import java.time.Instant

/**
 * 카드 하나의 기억 상태. flashcard 는 유저 기준이라 다른 곡에서 익힌 단어도 여기서 같은 칸으로 센다.
 *
 * FSRS stability `S` 는 정의상 retrievability 가 0.9 로 떨어지는 경과일수라, "7일 뒤에 떠올릴 확률
 * 90% 이상" 은 `stability >= 7` 한 줄로 판정된다. FSRS state(REVIEW 여부)와는 기준이 다르다.
 *
 * 곡 상세 이해도·단계와 복습 완주 카드의 기억 이동 집계가 같은 판정을 써야 해서 여기 한 곳에만 둔다.
 */
enum class FlashcardMemory {
    LONG_TERM, SHORT_TERM, REMAINING;

    companion object {
        const val LONG_TERM_STABILITY_DAYS = 7.0

        fun of(card: FlashcardEntity?): FlashcardMemory = when {
            card?.lastReview == null -> REMAINING
            card.stability >= LONG_TERM_STABILITY_DAYS -> LONG_TERM
            else -> SHORT_TERM
        }

        /** 리뷰 직후의 칸. 리뷰를 마친 카드는 이력이 생기므로 REMAINING 일 수 없다. */
        fun ofReviewed(stability: Double): FlashcardMemory =
            if (stability >= LONG_TERM_STABILITY_DAYS) LONG_TERM else SHORT_TERM

        /** 지금 학습할 단어 — 한 번도 리뷰하지 않았거나 due 가 지났다. */
        fun isDue(card: FlashcardEntity?, now: Instant): Boolean =
            card?.lastReview == null || card.due <= now
    }
}
