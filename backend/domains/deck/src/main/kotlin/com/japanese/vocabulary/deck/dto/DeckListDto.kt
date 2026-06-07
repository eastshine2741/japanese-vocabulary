package com.japanese.vocabulary.deck.dto

data class DeckListDto(
    val items: List<DeckSummaryDto>,
    val nextCursor: Long?,
)
