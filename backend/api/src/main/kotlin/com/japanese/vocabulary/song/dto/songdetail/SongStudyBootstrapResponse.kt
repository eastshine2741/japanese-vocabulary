package com.japanese.vocabulary.song.dto.songdetail

import com.japanese.vocabulary.flashcard.dto.FlashcardDto
import com.japanese.vocabulary.flashcard.model.FlashcardMemory

data class SongStudyBootstrapResponse(
    val deckId: Long,
    val cards: List<FlashcardDto>,
    val totalCount: Int,
    val nextDueAt: String?,
    /**
     * 방금 리뷰한 lead 단어의 리뷰 **후** 기억 칸. lead 는 이 호출에서 처음 담긴 단어라
     * 리뷰 전 칸은 항상 REMAINING 이다 — 앱이 기억 이동을 셀 때 이 값만 있으면 된다.
     */
    val reviewedMemory: FlashcardMemory,
)
