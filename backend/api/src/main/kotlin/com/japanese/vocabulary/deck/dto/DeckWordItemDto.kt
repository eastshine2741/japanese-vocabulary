package com.japanese.vocabulary.deck.dto

import com.japanese.vocabulary.word.dto.WordSenseDto

data class DeckWordItemDto(
    val id: Long,
    val japanese: String,
    val reading: String,
    val senses: List<WordSenseDto>,
)
