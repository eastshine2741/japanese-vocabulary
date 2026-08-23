package com.japanese.vocabulary.word.dto

import com.japanese.vocabulary.word.model.WordSense

/**
 * [senses] 는 부분 갱신이 아니라 전체 replace 다. JSON 원소에는 DB id 가 없어 개별 삭제 계약이 성립하지 않는다.
 */
data class UpdateWordDto(
    val reading: String?,
    val senses: List<WordSense>,
    val resetFlashcard: Boolean = false,
)
