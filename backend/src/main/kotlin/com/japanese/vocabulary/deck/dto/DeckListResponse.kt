package com.japanese.vocabulary.deck.dto

data class DeckListResponse(
    val allDeck: AllDeckSummary,
    val songDecks: List<SongDeckSummary>
)

data class AllDeckSummary(
    val wordCount: Int,
    val avgRetrievability: Double?
)

data class SongDeckSummary(
    val songId: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val wordCount: Int,
    val avgRetrievability: Double?
)
