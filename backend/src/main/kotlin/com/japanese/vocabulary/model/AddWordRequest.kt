package com.japanese.vocabulary.model

data class AddWordRequest(
    val japanese: String,
    val reading: String,
    val koreanText: String,
    val songId: Long,
    val lyricLine: String
)
