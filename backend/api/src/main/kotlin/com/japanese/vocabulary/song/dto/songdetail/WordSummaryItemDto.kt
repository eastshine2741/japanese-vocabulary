package com.japanese.vocabulary.song.dto.songdetail

data class WordSummaryItemDto(
    val japanese: String,
    val reading: String?,
    val koreanText: String?,
    val jlpt: String?,
    val importanceScore: Double,
)
