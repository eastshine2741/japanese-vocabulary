package com.japanese.vocabulary.word.dto

import com.japanese.vocabulary.word.model.WordMeaning

data class AddWordDto(
    val japanese: String,
    val reading: String,
    val koreanText: String,
    val partOfSpeech: String = "",
    val songId: Long,
    val lyricLine: String,
    val koreanLyricLine: String? = null,
    val meanings: List<WordMeaning> = emptyList(),
    val examples: List<AddWordExampleDto> = emptyList(),
)
