package com.japanese.vocabulary.word.dto

data class AddWordRequest(
    val japanese: String,
    val reading: String,
    val koreanText: String,
    val partOfSpeech: String = "",
    val songId: Long,
    val lyricLine: String
)
