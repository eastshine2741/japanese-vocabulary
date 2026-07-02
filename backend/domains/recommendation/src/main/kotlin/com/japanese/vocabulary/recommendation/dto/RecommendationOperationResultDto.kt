package com.japanese.vocabulary.recommendation.dto

data class RecommendationOperationResultDto(
    val processed: Int,
    val succeeded: Int,
    val skipped: Int,
    val failed: Int,
    val items: List<RecommendationOperationItemDto>,
)
