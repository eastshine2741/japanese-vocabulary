package com.japanese.vocabulary.app.flashcard.dto

import kotlinx.serialization.Serializable

@Serializable
data class ReviewRequest(
    val rating: Int
)
