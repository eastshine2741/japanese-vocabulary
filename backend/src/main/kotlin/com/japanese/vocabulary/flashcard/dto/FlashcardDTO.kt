package com.japanese.vocabulary.flashcard.dto

import com.japanese.vocabulary.word.dto.ExampleSentence
import com.japanese.vocabulary.word.dto.WordMeaning

data class FlashcardDTO(
    val id: Long,
    val wordId: Long,
    val japanese: String,
    val reading: String?,
    val meanings: List<WordMeaning>,
    val examples: List<ExampleSentence> = emptyList(),
    val state: Int,
    val due: String,
    val intervals: Map<Int, String>? = null
)
