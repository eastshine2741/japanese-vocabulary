package com.japanese.vocabulary.flashcard.dto

data class FlashcardStatsResponse(
    val total: Long,
    val due: Long,
    val newCount: Long,
    val learning: Long,
    val review: Long
)
