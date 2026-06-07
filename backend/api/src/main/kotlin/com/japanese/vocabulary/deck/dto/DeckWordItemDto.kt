package com.japanese.vocabulary.deck.dto

import com.japanese.vocabulary.word.model.WordMeaning

data class DeckWordItemDto(
    val id: Long,
    val japanese: String,
    val reading: String,
    val meanings: List<WordMeaning>,
)
