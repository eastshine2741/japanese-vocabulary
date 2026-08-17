package com.japanese.vocabulary.deck.dto

data class CreateDeckDto(
    val title: String,
    val description: String? = null,
)
