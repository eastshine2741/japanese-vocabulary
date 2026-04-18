package com.japanese.vocabulary.deck.dto

import com.japanese.vocabulary.word.dto.WordMeaning

data class DeckWordListResponse(
    val words: List<DeckWordItem>,
    val nextCursor: Long?
)

data class DeckWordItem(
    val id: Long,
    val japanese: String,
    val reading: String,
    val meanings: List<WordMeaning>
)
