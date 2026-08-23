package com.japanese.vocabulary.word.dto

import com.japanese.vocabulary.word.model.WordSense

/**
 * [songId] 는 예문의 출처가 아니라 "어느 화면에서 담았는가"다. 값이 있으면 해당 곡 단어장에도 연결된다.
 */
data class AddWordDto(
    val japanese: String,
    val reading: String? = null,
    val senses: List<WordSense> = emptyList(),
    val songId: Long? = null,
)
