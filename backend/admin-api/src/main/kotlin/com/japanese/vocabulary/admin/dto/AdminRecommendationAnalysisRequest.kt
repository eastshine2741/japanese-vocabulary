package com.japanese.vocabulary.admin.dto

data class AdminRecommendationAnalysisRequest(
    val candidateIds: List<Long> = emptyList(),
)
