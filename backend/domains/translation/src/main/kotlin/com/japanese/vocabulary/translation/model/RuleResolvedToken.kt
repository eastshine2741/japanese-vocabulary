package com.japanese.vocabulary.translation.model

import com.japanese.vocabulary.song.model.PartOfSpeech

data class RuleResolvedToken(
    val surface: String,
    val baseForm: String,
    val reading: String?,
    val baseFormReading: String?,
    val partOfSpeech: PartOfSpeech,
    val koreanText: String,
    val jlpt: String? = null,
)
