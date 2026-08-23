package com.japanese.vocabulary.flashcard.dto

import com.japanese.vocabulary.word.dto.WordSenseDto

data class FlashcardDto(
    val id: Long,
    val wordId: Long,
    val japanese: String,
    val reading: String?,
    val senses: List<WordSenseDto> = emptyList(),
    val state: Int,
    val due: String,
    val intervals: Map<Int, String>? = null,
)
