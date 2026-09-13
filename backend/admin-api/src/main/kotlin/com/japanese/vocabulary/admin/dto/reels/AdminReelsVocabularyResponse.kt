package com.japanese.vocabulary.admin.dto.reels

data class AdminReelsVocabularyResponse(
    val japanese: String,
    val reading: String,
    val korean: String,
    val partOfSpeech: String? = null,
    val partOfSpeechLabel: String? = null,
    val jlpt: String? = null,
)
