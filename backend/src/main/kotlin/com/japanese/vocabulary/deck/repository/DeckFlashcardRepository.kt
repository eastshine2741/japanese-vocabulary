package com.japanese.vocabulary.deck.repository

import com.japanese.vocabulary.deck.entity.DeckFlashcardEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface DeckFlashcardRepository : JpaRepository<DeckFlashcardEntity, Long> {
    fun findByDeckId(deckId: Long): List<DeckFlashcardEntity>
    fun findByDeckIdIn(deckIds: List<Long>): List<DeckFlashcardEntity>
    fun existsByDeckIdAndFlashcardId(deckId: Long, flashcardId: Long): Boolean
}
