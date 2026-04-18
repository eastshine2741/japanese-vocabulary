package com.japanese.vocabulary.deck.event

import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckFlashcardEntity
import com.japanese.vocabulary.deck.repository.DeckFlashcardRepository
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.flashcard.event.FlashcardCreatedEvent
import com.japanese.vocabulary.flashcard.event.FlashcardDeletedEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

@Component
class DeckEventListener(
    private val deckRepository: DeckRepository,
    private val deckFlashcardRepository: DeckFlashcardRepository
) {
    @EventListener
    fun onFlashcardCreated(event: FlashcardCreatedEvent) {
        val deck = deckRepository.findByUserIdAndSongId(event.userId, event.songId)
            ?: deckRepository.save(DeckEntity(userId = event.userId, songId = event.songId))

        if (!deckFlashcardRepository.existsByDeckIdAndFlashcardId(deck.id!!, event.flashcardId)) {
            deckFlashcardRepository.save(DeckFlashcardEntity(deckId = deck.id, flashcardId = event.flashcardId))
        }
    }

    @EventListener
    fun onFlashcardDeleted(event: FlashcardDeletedEvent) {
        deckFlashcardRepository.deleteByFlashcardId(event.flashcardId)
    }
}
