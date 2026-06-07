package com.japanese.vocabulary.translation.client.gemini.dto

data class WordMeaningResultDto(
    val index: Int,
    val words: List<WordMeaningDto>
)
