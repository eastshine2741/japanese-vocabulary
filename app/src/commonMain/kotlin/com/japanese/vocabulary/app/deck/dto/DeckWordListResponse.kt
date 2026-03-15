package com.japanese.vocabulary.app.deck.dto

import kotlinx.serialization.Serializable

@Serializable
data class DeckWordListResponse(
    val words: List<DeckWordItem>,
    val nextCursor: Long? = null
)

@Serializable
data class DeckWordItem(
    val id: Long,
    val japanese: String,
    val reading: String,
    val koreanText: String
)
