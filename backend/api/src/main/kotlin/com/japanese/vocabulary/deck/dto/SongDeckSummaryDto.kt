package com.japanese.vocabulary.deck.dto

/** [songId] 가 null 이면 곡에 매핑되지 않은 일반 단어장이다. */
data class SongDeckSummaryDto(
    val deckId: Long,
    val songId: Long?,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val wordCount: Int,
    val dueCount: Int,
    val masteredCount: Int,
    val studyingCount: Int,
    val newWordCount: Int,
)
