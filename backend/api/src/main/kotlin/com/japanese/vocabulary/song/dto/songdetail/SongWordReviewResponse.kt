package com.japanese.vocabulary.song.dto.songdetail

import com.japanese.vocabulary.flashcard.model.FlashcardMemory
import com.japanese.vocabulary.rewardcard.dto.RewardCardRevealDto

data class SongWordReviewResponse(
    /** 이 rating 이 곡 단어장을 처음 만들었을 수 있다. 앱은 이 값으로 세션을 곡 단어장에 잇는다. */
    val deckId: Long,
    val id: Long,
    val wordId: Long,
    /** 리뷰 **후** 기억 칸. */
    val memory: FlashcardMemory,
    val rewardCards: List<RewardCardRevealDto> = emptyList(),
)
