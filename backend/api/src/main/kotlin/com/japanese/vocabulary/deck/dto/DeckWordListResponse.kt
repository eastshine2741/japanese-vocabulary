package com.japanese.vocabulary.deck.dto

data class DeckWordListResponse(
    val words: List<DeckWordItemDto>,
    val nextCursor: Long?,
)
