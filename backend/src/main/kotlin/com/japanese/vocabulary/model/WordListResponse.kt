package com.japanese.vocabulary.model

data class WordListItem(
    val id: Long,
    val japanese: String,
    val reading: String,
    val koreanText: String,
    val songTitle: String?,
    val lyricLine: String?
)

data class WordListResponse(
    val words: List<WordListItem>,
    val nextCursor: Long?
)
