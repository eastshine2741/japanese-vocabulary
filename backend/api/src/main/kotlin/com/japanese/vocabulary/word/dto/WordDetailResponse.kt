package com.japanese.vocabulary.word.dto

data class WordDetailResponse(
    val id: Long,
    val japanese: String,
    val reading: String?,
    val meanings: List<WordMeaning>,
    val examples: List<ExampleSentence>
)
