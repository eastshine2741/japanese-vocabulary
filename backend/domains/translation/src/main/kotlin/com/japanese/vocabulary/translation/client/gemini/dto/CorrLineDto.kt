package com.japanese.vocabulary.translation.client.gemini.dto

/** One lyric line after the translation-grounded correction pass. */
data class CorrLineDto(
    val index: Int,
    val words: List<CorrWordDto>,
)
