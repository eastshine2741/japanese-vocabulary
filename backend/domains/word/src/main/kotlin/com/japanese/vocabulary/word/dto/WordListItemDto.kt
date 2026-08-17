package com.japanese.vocabulary.word.dto

data class WordListItemDto(
    val id: Long,
    val japanese: String,
    val reading: String,
    val senses: List<WordSenseDto> = emptyList(),
)
