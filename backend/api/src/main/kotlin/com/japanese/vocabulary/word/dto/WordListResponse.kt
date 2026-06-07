package com.japanese.vocabulary.word.dto

data class WordListResponse(
    val words: List<WordListItemDto>,
    val nextCursor: Long?,
)
