package com.japanese.vocabulary.song.model

data class Token(
    val surface: String,
    val baseForm: String,
    val reading: String?,
    val baseFormReading: String?,
    val partOfSpeech: PartOfSpeech,
    val charStart: Int,
    val charEnd: Int,
    val koreanText: String? = null
)
