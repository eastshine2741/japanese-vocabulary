package com.japanese.vocabulary.deck.repository

import com.japanese.vocabulary.deck.entity.DeckFlashcardEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface DeckFlashcardRepository : JpaRepository<DeckFlashcardEntity, Long> {
    fun findByDeckId(deckId: Long): List<DeckFlashcardEntity>
    fun findByDeckIdIn(deckIds: List<Long>): List<DeckFlashcardEntity>
    fun existsByDeckIdAndFlashcardId(deckId: Long, flashcardId: Long): Boolean

    @Modifying
    @Query("delete from DeckFlashcardEntity df where df.flashcardId = :flashcardId")
    fun deleteByFlashcardId(@Param("flashcardId") flashcardId: Long): Int
}
