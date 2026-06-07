package com.japanese.vocabulary.deck.dto

data class SongDeckSummaryDto(
    val deckId: Long,
    val songId: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val wordCount: Int,
    val dueCount: Int,
    val masteredCount: Int,
)
