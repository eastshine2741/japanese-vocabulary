package com.japanese.vocabulary.flashcard.dto

import com.japanese.vocabulary.flashcard.model.FlashcardMemory
import com.japanese.vocabulary.word.dto.WordSenseDto

data class FlashcardDto(
    val id: Long,
    val wordId: Long,
    val japanese: String,
    val reading: String?,
    val senses: List<WordSenseDto> = emptyList(),
    val state: Int,
    val due: String,
    val intervals: Map<Int, String>? = null,
    /** 이 카드를 아직 리뷰하기 전의 기억 칸. 복습 뒤 [ReviewResultDto.memory] 와 비교해 이동을 센다. */
    val memory: FlashcardMemory,
)
