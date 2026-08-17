package com.japanese.vocabulary.word.model

/**
 * 단어의 뜻 하나. `words.senses` JSON 에 비정규화 저장된다.
 * 동일성 기준은 [meaning] 텍스트 문자열 일치다.
 */
data class WordSense(
    val meaning: String,
    val partOfSpeech: String = "",
    val jlpt: String? = null,
    val examples: List<SenseExample> = emptyList(),
)
