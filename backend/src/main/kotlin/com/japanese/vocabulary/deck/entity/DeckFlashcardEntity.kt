package com.japanese.vocabulary.deck.entity

import jakarta.persistence.*

@Entity
@Table(name = "deck_flashcards")
class DeckFlashcardEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "deck_id", nullable = false)
    val deckId: Long,

    @Column(name = "flashcard_id", nullable = false)
    val flashcardId: Long
)
