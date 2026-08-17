package com.japanese.vocabulary.deck.dto

data class DeckResponse(
    val deckId: Long,
    val songId: Long?,
    val isDefault: Boolean,
    val title: String,
    val description: String,
)
