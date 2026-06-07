package com.japanese.vocabulary.song.client.gemini.dto

data class WordMeaningResultDto(
    val index: Int,
    val words: List<WordMeaningDto>
)
