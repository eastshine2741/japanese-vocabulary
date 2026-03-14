package com.japanese.vocabulary.app.flashcard.dto

import com.japanese.vocabulary.app.word.dto.ExampleSentence
import kotlinx.serialization.Serializable

@Serializable
data class FlashcardDTO(
    val id: Long,
    val wordId: Long,
    val japanese: String,
    val reading: String? = null,
    val koreanText: String? = null,
    val examples: List<ExampleSentence> = emptyList(),
    val state: Int,
    val due: String,
    val intervals: Map<Int, String>? = null
)
