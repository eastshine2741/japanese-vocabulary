package com.japanese.vocabulary.model

data class Token(
    val surface: String,
    val baseForm: String,
    val reading: String?,
    val partOfSpeech: String,
    val charStart: Int,
    val charEnd: Int
)
