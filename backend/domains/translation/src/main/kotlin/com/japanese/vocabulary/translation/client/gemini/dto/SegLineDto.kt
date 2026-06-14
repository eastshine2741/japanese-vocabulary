package com.japanese.vocabulary.translation.client.gemini.dto

/** One lyric line after LLM segmentation + lemmatization (L3 stage 1). */
data class SegLineDto(
    val index: Int,
    val words: List<SegWordDto>,
)
