package com.japanese.vocabulary.word.dto

import com.japanese.vocabulary.word.model.WordSense

/** [senses] 는 전체 replace 다 — 뜻 추가·삭제·순서변경·예문 삭제가 모두 이 경로 하나로 처리된다. */
data class UpdateWordRequest(
    val reading: String?,
    val senses: List<WordSense>,
    val resetFlashcard: Boolean = false,
)
