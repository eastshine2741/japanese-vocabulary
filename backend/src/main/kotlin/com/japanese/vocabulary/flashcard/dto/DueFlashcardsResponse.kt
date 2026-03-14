package com.japanese.vocabulary.flashcard.dto

data class DueFlashcardsResponse(
    val cards: List<FlashcardDTO>,
    val totalCount: Int
)
