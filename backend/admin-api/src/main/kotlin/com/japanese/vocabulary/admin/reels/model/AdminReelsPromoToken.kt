package com.japanese.vocabulary.admin.reels.model

data class AdminReelsPromoToken(
    val surface: String,
    val baseForm: String,
    val reading: String? = null,
    val baseFormReading: String? = null,
    val partOfSpeech: String,
    val charStart: Int,
    val charEnd: Int,
    val koreanText: String? = null,
    val jlpt: String? = null,
)
