package com.japanese.vocabulary.flashcard.dto

import com.japanese.vocabulary.flashcard.model.FlashcardMemory

data class ReviewResultDto(
    val id: Long,
    val state: Int,
    val due: String,
    val stability: Double,
    val difficulty: Double,
    /** 이 리뷰를 반영한 뒤의 기억 칸. */
    val memory: FlashcardMemory,
)
