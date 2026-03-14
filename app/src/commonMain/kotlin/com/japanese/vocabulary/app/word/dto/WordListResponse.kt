package com.japanese.vocabulary.app.word.dto

import kotlinx.serialization.Serializable

@Serializable
data class WordListResponse(
    val words: List<WordListItem>,
    val nextCursor: Long? = null
)
