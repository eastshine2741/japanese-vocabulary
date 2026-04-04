package com.japanese.vocabulary.song.client.gemini.dto

data class TranslationResult(
    val index: Int,
    val koreanLyrics: String,
    val koreanPronounciation: String
)
