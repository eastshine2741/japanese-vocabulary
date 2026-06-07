package com.japanese.vocabulary.translation.client.gemini.dto

data class TranslationResultDto(
    val index: Int,
    val koreanLyrics: String,
    val koreanPronounciation: String
)
