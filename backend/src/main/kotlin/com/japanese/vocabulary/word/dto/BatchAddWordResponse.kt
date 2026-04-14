package com.japanese.vocabulary.word.dto

data class BatchAddWordResponse(
    val savedCount: Int,
    val skippedCount: Int
)
