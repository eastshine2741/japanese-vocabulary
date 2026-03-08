package com.japanese.vocabulary.model

data class VocabularyData(
    val surface: String,
    val baseForm: String,
    val reading: String?,
    val partOfSpeech: String,
    val sourceLineIndex: Int,
    val charStart: Int,
    val charEnd: Int
)
