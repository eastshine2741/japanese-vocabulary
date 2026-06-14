package com.japanese.vocabulary.translation.client.gemini.dto

/** One lyric line after sense-selection (redesign stage 3). */
data class SelectLineDto(
    val index: Int,
    val words: List<SelectWordDto>,
)
