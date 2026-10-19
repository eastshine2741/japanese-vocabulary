package com.japanese.vocabulary.flashcard.dto

data class FlashcardStatsResponse(
    val total: Long,
    val due: Long,
    val newCount: Long,
    val learning: Long,
    val review: Long,
    val longTermCount: Long,
    val shortTermCount: Long,
)

fun FlashcardStatsDto.toResponse() = FlashcardStatsResponse(
    total = total,
    due = due,
    newCount = newCount,
    learning = learning,
    review = review,
    longTermCount = longTermCount,
    shortTermCount = shortTermCount,
)
