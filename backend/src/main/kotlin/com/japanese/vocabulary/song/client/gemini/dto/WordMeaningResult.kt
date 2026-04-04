package com.japanese.vocabulary.song.client.gemini.dto

data class WordMeaningResult(
    val index: Int,
    val words: List<WordMeaning>
)

data class WordMeaning(
    val surface: String,
    val baseForm: String,
    val koreanText: String
)
