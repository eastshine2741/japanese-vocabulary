package com.japanese.vocabulary.admin.dto

import com.japanese.vocabulary.recommendation.entity.RecommendationCandidateStatus

data class AdminRecommendationCandidateStatusUpdateRequest(
    val status: RecommendationCandidateStatus,
)
