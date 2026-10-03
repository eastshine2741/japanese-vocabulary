package com.japanese.vocabulary.flashcard.dto

import com.japanese.vocabulary.flashcard.model.FlashcardMemory

data class ReviewResponse(
    val id: Long,
    val state: Int,
    val due: String,
    val stability: Double,
    val difficulty: Double,
    /** 이 리뷰를 반영한 뒤의 기억 칸. 앱이 리뷰 전 칸과 비교해 완주 카드의 기억 이동을 센다. */
    val memory: FlashcardMemory,
)
