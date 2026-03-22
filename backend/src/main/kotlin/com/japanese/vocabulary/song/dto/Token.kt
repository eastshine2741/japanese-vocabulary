package com.japanese.vocabulary.song.dto

data class Token(
    val surface: String,
    val baseForm: String,
    val reading: String?,
    val partOfSpeech: String,
    val charStart: Int,
    val charEnd: Int,
    val koreanText: String? = null
)
