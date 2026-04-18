package com.japanese.vocabulary.word.dto

data class WordListResponse(
    val words: List<WordListItem>,
    val nextCursor: Long?
)
