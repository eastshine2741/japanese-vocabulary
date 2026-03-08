package com.japanese.vocabulary.model

data class StudyUnit(
    val index: Int,
    val originalText: String,
    val startTimeMs: Long? = null,
    val tokens: List<Token> = emptyList()
)
