package com.japanese.vocabulary.app.deck.dto

import kotlinx.serialization.Serializable

@Serializable
data class DeckListResponse(
    val allDeck: AllDeckSummary,
    val songDecks: List<SongDeckSummary>
)

@Serializable
data class AllDeckSummary(
    val wordCount: Int,
    val avgRetrievability: Double? = null
)

@Serializable
data class SongDeckSummary(
    val songId: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String? = null,
    val wordCount: Int,
    val avgRetrievability: Double? = null
)
