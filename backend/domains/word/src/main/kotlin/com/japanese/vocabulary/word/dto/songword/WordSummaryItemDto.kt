package com.japanese.vocabulary.word.dto.songword

data class WordSummaryItemDto(
    val japanese: String,
    val reading: String?,
    val koreanText: String?,
    val jlpt: String?,
    val importanceScore: Double,
)
