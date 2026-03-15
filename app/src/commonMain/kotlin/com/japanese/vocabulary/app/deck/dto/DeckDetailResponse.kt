package com.japanese.vocabulary.app.deck.dto

import kotlinx.serialization.Serializable

@Serializable
data class DeckDetailResponse(
    val songId: Long? = null,
    val title: String? = null,
    val artist: String? = null,
    val artworkUrl: String? = null,
    val wordCount: Int,
    val dueCount: Int,
    val stateCounts: StateCounts,
    val avgRetrievability: Double? = null
)

@Serializable
data class StateCounts(
    val new: Int,
    val learning: Int,
    val review: Int,
    val relearning: Int
)
