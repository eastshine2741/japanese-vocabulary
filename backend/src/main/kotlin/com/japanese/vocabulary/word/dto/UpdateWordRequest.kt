package com.japanese.vocabulary.word.dto

data class UpdateWordRequest(
    val reading: String?,
    val meanings: List<WordMeaning>,
    val resetFlashcard: Boolean = false
)
