package com.japanese.vocabulary.song.dto

data class TokenInfo(
    val surface: String,
    val baseForm: String,
    val reading: String?,
    val partOfSpeech: PartOfSpeech,
    val charStart: Int,
    val charEnd: Int
)
