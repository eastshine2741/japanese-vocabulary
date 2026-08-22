package com.japanese.vocabulary.recommendation.dto

data class RecommendationOperationItemDto(
    val candidateId: Long,
    val status: String,
    val songId: Long? = null,
    val lyricId: Long? = null,
    val workId: Long? = null,
    val recommendationId: Long? = null,
    val message: String? = null,
)
