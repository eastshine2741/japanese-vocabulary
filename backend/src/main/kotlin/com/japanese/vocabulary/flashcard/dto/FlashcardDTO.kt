package com.japanese.vocabulary.flashcard.dto

import com.japanese.vocabulary.word.dto.ExampleSentence

data class FlashcardDTO(
    val id: Long,
    val wordId: Long,
    val japanese: String,
    val reading: String?,
    val koreanText: String?,
    val examples: List<ExampleSentence> = emptyList(),
    val state: Int,
    val due: String,
    val intervals: Map<Int, String>? = null
)
