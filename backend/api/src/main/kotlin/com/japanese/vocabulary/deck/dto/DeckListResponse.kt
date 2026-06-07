package com.japanese.vocabulary.deck.dto

data class DeckListResponse(
    val songDecks: List<SongDeckSummaryDto>,
    val nextCursor: Long?,
)
