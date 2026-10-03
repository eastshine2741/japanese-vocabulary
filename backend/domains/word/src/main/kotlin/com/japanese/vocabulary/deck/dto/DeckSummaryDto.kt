package com.japanese.vocabulary.deck.dto

data class DeckSummaryDto(
    val deckId: Long,
    val songId: Long?,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val wordCount: Int,
    val dueCount: Int,
    val masteredCount: Int,
    val studyingCount: Int,
    val newWordCount: Int,
    /** 장기기억 — `stability >= 7일`. FSRS state 기준인 [masteredCount] 와 판정이 다르다. */
    val longTermCount: Int,
    /** 단기기억 — 리뷰 이력이 있으나 장기기억이 아닌 단어. `남음` 은 앱이 뺄셈으로 구한다. */
    val shortTermCount: Int,
)
