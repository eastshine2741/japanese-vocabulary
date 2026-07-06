package com.japanese.vocabulary.word.dto

data class AddWordExampleRequest(
    val songId: Long,
    val lyricLine: String? = null,
    val koreanLyricLine: String? = null,
)
