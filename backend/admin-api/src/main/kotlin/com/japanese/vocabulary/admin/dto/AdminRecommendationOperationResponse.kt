package com.japanese.vocabulary.admin.dto

data class AdminRecommendationOperationResponse(
    val processed: Int,
    val succeeded: Int,
    val skipped: Int,
    val failed: Int,
    val items: List<AdminRecommendationOperationItemResponse>,
)
