package com.japanese.vocabulary.word.dto

data class WordDefinitionDto(
    val japanese: String,
    val reading: String,
    val meanings: List<String>,
    val partsOfSpeech: List<String>,
    val jlptLevel: String?
)
