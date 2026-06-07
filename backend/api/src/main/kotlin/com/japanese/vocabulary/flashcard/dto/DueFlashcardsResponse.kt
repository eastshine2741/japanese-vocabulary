package com.japanese.vocabulary.flashcard.dto

data class DueFlashcardsResponse(
    val cards: List<FlashcardDto>,
    val totalCount: Int,
)
