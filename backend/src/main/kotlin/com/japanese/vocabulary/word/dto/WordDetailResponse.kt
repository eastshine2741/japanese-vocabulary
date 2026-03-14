package com.japanese.vocabulary.word.dto

data class WordDetailResponse(
    val id: Long,
    val japanese: String,
    val reading: String?,
    val koreanText: String?,
    val examples: List<ExampleSentence>
)
