package com.japanese.vocabulary.word.dto

data class WordSenseDto(
    val meaning: String,
    val partOfSpeech: String,
    val jlpt: String?,
    val examples: List<SenseExampleDto> = emptyList(),
)
