package com.japanese.vocabulary.app.flashcard.dto

import kotlinx.serialization.Serializable

@Serializable
data class FlashcardDTO(
    val id: Long,
    val wordId: Long,
    val japanese: String,
    val reading: String? = null,
    val koreanText: String? = null,
    val songTitle: String? = null,
    val lyricLine: String? = null,
    val state: Int,
    val due: String,
    val intervals: Map<Int, String>? = null
)
