package com.japanese.vocabulary.deck.dto

data class DeckListResponse(
    val songDecks: List<SongDeckSummary>,
    val nextCursor: Long?,
)

data class SongDeckSummary(
    val deckId: Long,
    val songId: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val wordCount: Int,
    val dueCount: Int,
    val masteredCount: Int
)
