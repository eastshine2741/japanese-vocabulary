package com.japanese.vocabulary.flashcard.dto

data class DueFlashcardsDto(
    val items: List<FlashcardDto>,
    val totalCount: Int,
)
