package com.japanese.vocabulary.deck.event

import org.springframework.stereotype.Component
import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckFlashcardEntity
import com.japanese.vocabulary.deck.repository.DeckFlashcardRepository
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.flashcard.event.FlashcardDeletedEvent
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.event.SongWordCreatedEvent
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

@Component
class DeckEventListener(
    private val deckRepository: DeckRepository,
    private val deckFlashcardRepository: DeckFlashcardRepository,
    private val songRepository: SongRepository,
) {
    // REQUIRES_NEW is mandatory on AFTER_COMMIT listeners that perform DML — see CLAUDE.md.
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun onSongWordCreated(event: SongWordCreatedEvent) {
        val deck = deckRepository.findByUserIdAndSongId(event.userId, event.songId)
            ?: run {
                val song = songRepository.findById(event.songId).orElseThrow {
                    IllegalStateException("Song ${event.songId} not found while creating deck")
                }
                deckRepository.save(
                    DeckEntity(
                        userId = event.userId,
                        songId = event.songId,
                        title = song.title,
                        description = song.artist,
                    )
                )
            }

        if (!deckFlashcardRepository.existsByDeckIdAndFlashcardId(deck.id!!, event.flashcardId)) {
            deckFlashcardRepository.save(
                DeckFlashcardEntity(deckId = deck.id, flashcardId = event.flashcardId)
            )
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    @Transactional
    fun onFlashcardDeleted(event: FlashcardDeletedEvent) {
        deckFlashcardRepository.deleteByFlashcardId(event.flashcardId)
    }
}
