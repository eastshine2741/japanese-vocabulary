package com.japanese.vocabulary.deck.dto

/**
 * Detailed view of a deck (or the synthetic "all decks" aggregate when [deckId] is null).
 */
data class DeckDetailDto(
    val deckId: Long?,
    val songId: Long?,
    val title: String?,
    val artist: String?,
    val artworkUrl: String?,
    val wordCount: Int,
    val dueCount: Int,
    val masteredCount: Int,
    val studyingCount: Int,
    val newWordCount: Int,
)
