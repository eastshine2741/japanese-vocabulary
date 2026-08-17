package com.japanese.vocabulary.word.dto

/**
 * 저장된 [com.japanese.vocabulary.word.model.SenseExample] 에 곡 메타데이터를 덧붙인 읽기 모델.
 */
data class SenseExampleDto(
    val text: String,
    val translation: String?,
    val songId: Long?,
    val lineIndex: Int?,
    val songTitle: String? = null,
    val artworkUrl: String? = null,
)
