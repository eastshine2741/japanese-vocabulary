package com.japanese.vocabulary.word.dto

data class ExampleSentence(
    val id: Long,
    val songId: Long,
    val songTitle: String?,
    val lyricLine: String?,
    val koreanLyricLine: String? = null,
    val artworkUrl: String? = null
)
