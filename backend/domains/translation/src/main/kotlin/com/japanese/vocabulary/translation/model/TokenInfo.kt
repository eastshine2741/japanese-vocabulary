package com.japanese.vocabulary.translation.model

import com.japanese.vocabulary.song.model.PartOfSpeech

data class TokenInfo(
    val surface: String,
    val baseForm: String,
    val reading: String?,
    val baseFormReading: String?,
    val partOfSpeech: PartOfSpeech,
    val charStart: Int,
    val charEnd: Int
)
