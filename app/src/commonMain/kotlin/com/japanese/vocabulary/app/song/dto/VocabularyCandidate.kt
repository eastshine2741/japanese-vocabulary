package com.japanese.vocabulary.app.song.dto

import kotlinx.serialization.Serializable

@Serializable
data class VocabularyCandidate(
    val word: String,
    val reading: String?,
    val partOfSpeech: String? = null,
    val sourceLineIndex: Int
)
