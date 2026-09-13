package com.japanese.vocabulary.song.dto.songdetail

import com.japanese.vocabulary.flashcard.dto.FlashcardDto

data class SongStudyBootstrapResponse(
    val deckId: Long,
    val cards: List<FlashcardDto>,
    val totalCount: Int,
    val nextDueAt: String?,
)
