package com.japanese.vocabulary.app.word.dto

import kotlinx.serialization.Serializable

@Serializable
data class AddWordRequest(
    val japanese: String,
    val reading: String,
    val koreanText: String,
    val songId: Long,
    val lyricLine: String
)
