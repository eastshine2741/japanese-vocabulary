package com.japanese.vocabulary.word.dto

data class AddWordExampleDto(
    val songId: Long,
    val lyricLine: String? = null,
    val koreanLyricLine: String? = null,
)
