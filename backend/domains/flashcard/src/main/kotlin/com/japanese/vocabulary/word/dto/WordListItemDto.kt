package com.japanese.vocabulary.word.dto

import com.japanese.vocabulary.word.model.ExampleSentence
import com.japanese.vocabulary.word.model.WordMeaning

data class WordListItemDto(
    val id: Long,
    val japanese: String,
    val reading: String,
    val meanings: List<WordMeaning>,
    val examples: List<ExampleSentence> = emptyList()
)
