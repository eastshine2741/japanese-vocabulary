package com.japanese.vocabulary.translation.client.gemini.dto

/** A Korean meaning for one chosen jisho sense (redesign stage 4): English gloss → Korean. */
data class SenseTranslationDto(
    val senseId: Int,
    val koreanText: String,
)
