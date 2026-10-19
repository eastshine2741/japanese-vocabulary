package com.japanese.vocabulary.deck.dto

/** 곡 단어장에서 한 번이라도 리뷰한 단어 수와 그중 지금 due 인 수. */
data class SongDeckReviewDto(
    val songId: Long,
    val reviewedCount: Long,
    val dueCount: Long,
)
