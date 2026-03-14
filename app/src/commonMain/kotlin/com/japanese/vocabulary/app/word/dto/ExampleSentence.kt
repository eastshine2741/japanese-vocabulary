package com.japanese.vocabulary.app.word.dto

import kotlinx.serialization.Serializable

@Serializable
data class ExampleSentence(
    val songId: Long,
    val songTitle: String? = null,
    val lyricLine: String? = null
)
