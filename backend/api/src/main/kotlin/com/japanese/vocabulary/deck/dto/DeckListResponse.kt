package com.japanese.vocabulary.deck.dto

data class DeckListResponse(
    val songDecks: List<SongDeckSummary>
)

data class SongDeckSummary(
    val songId: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val wordCount: Int,
    val dueCount: Int,
    val masteredCount: Int
)
