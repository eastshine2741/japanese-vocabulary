package com.japanese.vocabulary.word.dto

import com.japanese.vocabulary.word.model.WordSense

/**
 * [songId] 는 "어느 곡 화면에서 담았는가"다. 값이 있으면 해당 곡 단어장에도 담긴다.
 * 예문은 각 sense 안에 들어 있다.
 */
data class AddWordRequest(
    val japanese: String,
    val reading: String? = null,
    val senses: List<WordSense> = emptyList(),
    val songId: Long? = null,
)
