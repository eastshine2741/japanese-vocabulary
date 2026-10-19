package com.japanese.vocabulary.deck.dto

data class DeckListResponse(
    val songDecks: List<SongDeckSummaryDto>,
    val nextCursor: Long?,
)

fun DeckListDto.toResponse() = DeckListResponse(
    songDecks = items.map { it.toResponse() },
    nextCursor = nextCursor,
)

private fun DeckSummaryDto.toResponse() = SongDeckSummaryDto(
    deckId = deckId,
    songId = songId,
    title = title,
    artist = artist,
    artworkUrl = artworkUrl,
    wordCount = wordCount,
    dueCount = dueCount,
    masteredCount = masteredCount,
    studyingCount = studyingCount,
    newWordCount = newWordCount,
    longTermCount = longTermCount,
    shortTermCount = shortTermCount,
)
