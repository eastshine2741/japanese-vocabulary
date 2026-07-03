package com.japanese.vocabulary.admin.dto

data class AdminRecommendationOperationItemResponse(
    val candidateId: Long,
    val status: String,
    val workId: Long? = null,
    val recommendationId: Long? = null,
    val message: String? = null,
)
