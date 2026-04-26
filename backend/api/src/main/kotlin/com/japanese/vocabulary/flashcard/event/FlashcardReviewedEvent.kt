package com.japanese.vocabulary.flashcard.event

import java.time.Instant

data class FlashcardReviewedEvent(
    val userId: Long,
    val flashcardId: Long,
    val rating: Int,
    val reviewedAt: Instant,
)
