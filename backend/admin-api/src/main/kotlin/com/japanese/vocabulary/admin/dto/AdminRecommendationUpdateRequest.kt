package com.japanese.vocabulary.admin.dto

import com.japanese.vocabulary.recommendation.entity.SongRecommendationStatus

data class AdminRecommendationUpdateRequest(
    val status: SongRecommendationStatus? = null,
    val orderIndex: Int? = null,
)
