package com.japanese.vocabulary.song.dto.songdetail

import com.japanese.vocabulary.flashcard.dto.FlashcardDto

data class SongWordTierStudyResponse(
    val deckId: Long,
    /**
     * 단계 순서(후렴 정복·핵심은 중요도, 나머지는 등장순)의 카드. 현재 단계는 due 단어만 —
     * `dueCount` 와 같은 수다. 구버전 단계(핵심·입문·기초·심화)는 due 와 무관하게 전부.
     */
    val cards: List<FlashcardDto>,
    val totalCount: Int,
)
