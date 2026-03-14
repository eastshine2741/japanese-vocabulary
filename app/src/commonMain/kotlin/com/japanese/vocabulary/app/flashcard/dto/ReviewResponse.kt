package com.japanese.vocabulary.app.flashcard.dto

import kotlinx.serialization.Serializable

@Serializable
data class ReviewResponse(
    val id: Long,
    val state: Int,
    val due: String,
    val stability: Double,
    val difficulty: Double
)
