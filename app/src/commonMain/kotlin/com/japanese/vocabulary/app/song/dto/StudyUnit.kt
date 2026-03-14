package com.japanese.vocabulary.app.song.dto

import kotlinx.serialization.Serializable

@Serializable
data class StudyUnit(
    val index: Int,
    val originalText: String,
    val startTimeMs: Long? = null,
    val tokens: List<Token> = emptyList()
)
