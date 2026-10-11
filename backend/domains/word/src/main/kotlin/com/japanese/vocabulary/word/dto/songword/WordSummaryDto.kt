package com.japanese.vocabulary.word.dto.songword

data class WordSummaryDto(
    val topWords: List<WordSummaryItemDto> = emptyList(),
    val jlptDistribution: Map<String, Int> = emptyMap(),
    val totalCandidateCount: Int = 0,
    val defaultBulkAddCount: Int = 0,
)
