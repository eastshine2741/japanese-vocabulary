package com.japanese.vocabulary.word.dto

data class WordListDto(
    val items: List<WordListItemDto>,
    val nextCursor: Long?,
)
