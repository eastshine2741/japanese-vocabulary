package com.japanese.vocabulary.song.service.songdetail

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import java.time.Instant

/**
 * 곡 단어 하나의 기억 상태. 단어의 flashcard 는 유저 기준이라 다른 곡에서 익힌 단어도 여기서 센다.
 *
 * FSRS stability `S` 는 정의상 retrievability 가 0.9 로 떨어지는 경과일수라, "7일 뒤에 떠올릴 확률
 * 90% 이상" 은 `stability >= 7` 한 줄로 판정된다. FSRS state(REVIEW 여부)와는 기준이 다르다.
 */
enum class SongWordMemory {
    LONG_TERM, SHORT_TERM, REMAINING;

    companion object {
        const val LONG_TERM_STABILITY_DAYS = 7.0

        fun of(card: FlashcardEntity?): SongWordMemory = when {
            card?.lastReview == null -> REMAINING
            card.stability >= LONG_TERM_STABILITY_DAYS -> LONG_TERM
            else -> SHORT_TERM
        }

        /** 지금 학습할 단어 — 한 번도 리뷰하지 않았거나 due 가 지났다. */
        fun isDue(card: FlashcardEntity?, now: Instant): Boolean =
            card?.lastReview == null || card.due <= now
    }
}
