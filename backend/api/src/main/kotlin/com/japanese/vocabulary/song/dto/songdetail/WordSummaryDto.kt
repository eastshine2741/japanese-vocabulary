package com.japanese.vocabulary.song.dto.songdetail

data class WordSummaryDto(
    val topWords: List<WordSummaryItemDto> = emptyList(),
    val jlptDistribution: Map<String, Int> = emptyMap(),
    val totalCandidateCount: Int = 0,
    val defaultBulkAddCount: Int = 0,
)
