package com.japanese.vocabulary.translation.client.gemini.dto

data class KoreanLyricLineDto(
    val index: Int,
    val koreanLyrics: String,
    val koreanPronounciation: String,
    val words: List<VocabularyMeaningDto>? = null
)
