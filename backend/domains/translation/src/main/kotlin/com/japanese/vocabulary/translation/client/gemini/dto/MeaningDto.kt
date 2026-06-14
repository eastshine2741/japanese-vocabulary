package com.japanese.vocabulary.translation.client.gemini.dto

/** A jisho-grounded Korean meaning for one dictionary form (L3 stage 2). */
data class MeaningDto(
    val dictionaryForm: String,
    val koreanText: String,
)
