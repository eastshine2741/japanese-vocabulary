package com.japanese.vocabulary.translation.client.gemini.dto

/** One word after the translation-grounded correction pass (L3 correction). */
data class CorrWordDto(
    val surface: String,
    val dictionaryForm: String,
    val koreanText: String,
)
