package com.japanese.vocabulary.admin.dto.reels

data class AdminReelsLyricTokenResponse(
    val surface: String,
    val baseForm: String,
    val reading: String?,
    val baseFormReading: String?,
    val partOfSpeech: String,
    val charStart: Int,
    val charEnd: Int,
    val koreanText: String?,
    val jlpt: String?,
)
