package com.japanese.vocabulary.app.song.dto

import kotlinx.serialization.Serializable

@Serializable
data class Token(
    val surface: String,
    val baseForm: String,
    val reading: String?,
    val partOfSpeech: String,
    val charStart: Int,
    val charEnd: Int
)
