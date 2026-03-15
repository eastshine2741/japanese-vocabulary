package com.japanese.vocabulary.deck.dto

data class DeckDetailResponse(
    val songId: Long?,
    val title: String?,
    val artist: String?,
    val artworkUrl: String?,
    val wordCount: Int,
    val dueCount: Int,
    val stateCounts: StateCounts,
    val avgRetrievability: Double?
)

data class StateCounts(
    val new: Int,
    val learning: Int,
    val review: Int,
    val relearning: Int
)
