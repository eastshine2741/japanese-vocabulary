package com.japanese.vocabulary.flashcard.dto

data class FlashcardDTO(
    val id: Long,
    val wordId: Long,
    val japanese: String,
    val reading: String?,
    val koreanText: String?,
    val songTitle: String? = null,
    val lyricLine: String? = null,
    val state: Int,
    val due: String,
    val intervals: Map<Int, String>? = null
)
