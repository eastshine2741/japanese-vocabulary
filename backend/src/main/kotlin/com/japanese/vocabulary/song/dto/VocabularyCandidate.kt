package com.japanese.vocabulary.song.dto

data class VocabularyCandidate(
    val word: String,
    val reading: String?,
    val baseForm: String,
    val partOfSpeech: String,
    val sourceLineIndex: Int
)
