package com.japanese.vocabulary.model

data class VocabularyCandidate(
    val word: String,
    val reading: String?,
    val baseForm: String,
    val partOfSpeech: String,
    val sourceLineIndex: Int
)
