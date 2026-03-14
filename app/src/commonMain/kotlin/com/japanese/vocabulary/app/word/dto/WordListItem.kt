package com.japanese.vocabulary.app.word.dto

import kotlinx.serialization.Serializable

@Serializable
data class WordListItem(
    val id: Long,
    val japanese: String,
    val reading: String,
    val koreanText: String,
    val songTitle: String? = null,
    val lyricLine: String? = null
)
