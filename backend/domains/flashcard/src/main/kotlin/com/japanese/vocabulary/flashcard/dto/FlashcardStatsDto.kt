package com.japanese.vocabulary.flashcard.dto

data class FlashcardStatsDto(
    val total: Long,
    val due: Long,
    val newCount: Long,
    val learning: Long,
    val review: Long,
)
