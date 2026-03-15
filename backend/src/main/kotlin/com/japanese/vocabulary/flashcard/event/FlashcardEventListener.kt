package com.japanese.vocabulary.flashcard.event

import com.japanese.vocabulary.flashcard.service.FlashcardService
import com.japanese.vocabulary.word.event.WordAddedEvent
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

@Component
class FlashcardEventListener(
    private val flashcardService: FlashcardService,
    private val eventPublisher: ApplicationEventPublisher
) {
    @EventListener
    fun onWordAdded(event: WordAddedEvent) {
        val flashcardId = flashcardService.createFlashcard(event.userId, event.wordId)
        eventPublisher.publishEvent(FlashcardCreatedEvent(event.userId, flashcardId, event.songId))
    }
}
