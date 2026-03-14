package com.japanese.vocabulary.word.dto

data class WordListItem(
    val id: Long,
    val japanese: String,
    val reading: String,
    val koreanText: String,
    val songTitle: String?,
    val lyricLine: String?
)
