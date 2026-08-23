package com.japanese.vocabulary.flashcard.dto

data class ReviewResultDto(
    val id: Long,
    val state: Int,
    val due: String,
    val stability: Double,
    val difficulty: Double,
)
