package com.japanese.vocabulary.deck.repository

import com.japanese.vocabulary.deck.entity.DeckWordEntity
import org.springframework.data.jpa.repository.JpaRepository

interface DeckWordRepository : JpaRepository<DeckWordEntity, Long> {
    fun findByDeckId(deckId: Long): List<DeckWordEntity>
    fun existsByDeckIdAndWordId(deckId: Long, wordId: Long): Boolean
    fun deleteByWordId(wordId: Long)
}
