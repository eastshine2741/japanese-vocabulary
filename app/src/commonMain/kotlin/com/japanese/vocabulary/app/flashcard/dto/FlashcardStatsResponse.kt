package com.japanese.vocabulary.app.flashcard.dto

import kotlinx.serialization.Serializable

@Serializable
data class FlashcardStatsResponse(
    val total: Long,
    val due: Long,
    val newCount: Long,
    val learning: Long,
    val review: Long
)
