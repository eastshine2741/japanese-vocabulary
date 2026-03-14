package com.japanese.vocabulary.app.word.dto

import kotlinx.serialization.Serializable

@Serializable
data class WordDetailResponse(
    val id: Long,
    val japanese: String,
    val reading: String? = null,
    val koreanText: String? = null,
    val examples: List<ExampleSentence> = emptyList()
)
