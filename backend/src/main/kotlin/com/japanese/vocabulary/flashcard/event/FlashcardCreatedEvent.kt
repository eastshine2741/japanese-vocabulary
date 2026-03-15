package com.japanese.vocabulary.flashcard.event

data class FlashcardCreatedEvent(val userId: Long, val flashcardId: Long, val songId: Long)
