package com.japanese.vocabulary.song.dto.songdetail

import com.japanese.vocabulary.flashcard.dto.FlashcardDto

data class SongWordTierStudyResponse(
    val deckId: Long,
    /** 단계 단어 전부. due·복습 상태와 무관하며 단계 순서(핵심은 중요도, 나머지는 등장순)를 따른다. */
    val cards: List<FlashcardDto>,
    val totalCount: Int,
)
