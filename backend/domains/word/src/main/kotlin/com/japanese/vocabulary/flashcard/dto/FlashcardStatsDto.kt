package com.japanese.vocabulary.flashcard.dto

data class FlashcardStatsDto(
    val total: Long,
    val due: Long,
    val newCount: Long,
    val learning: Long,
    val review: Long,
    /** 장기기억 — `stability >= 7일`. FSRS state 기준인 [review] 와 판정이 다르다. */
    val longTermCount: Long,
    /** 단기기억 — 리뷰 이력이 있으나 장기기억이 아닌 카드. */
    val shortTermCount: Long,
)
