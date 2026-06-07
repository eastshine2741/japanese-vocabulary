package com.japanese.vocabulary.word.dto

import com.japanese.vocabulary.word.model.WordMeaning

data class UpdateWordDto(
    val reading: String?,
    val meanings: List<WordMeaning>,
    val resetFlashcard: Boolean = false,
    val deleteExampleIds: List<Long> = emptyList(),
)
