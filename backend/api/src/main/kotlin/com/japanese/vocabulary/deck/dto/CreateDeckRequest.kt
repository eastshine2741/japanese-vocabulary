package com.japanese.vocabulary.deck.dto

data class CreateDeckRequest(
    val title: String,
    val description: String? = null,
)
