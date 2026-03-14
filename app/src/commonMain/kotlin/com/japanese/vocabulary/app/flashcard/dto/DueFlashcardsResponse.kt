package com.japanese.vocabulary.app.flashcard.dto

import kotlinx.serialization.Serializable

@Serializable
data class DueFlashcardsResponse(
    val cards: List<FlashcardDTO>,
    val totalCount: Int
)
