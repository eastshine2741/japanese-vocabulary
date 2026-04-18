package com.japanese.vocabulary.word.dto

data class BatchAddWordRequest(
    val words: List<AddWordRequest>
)
