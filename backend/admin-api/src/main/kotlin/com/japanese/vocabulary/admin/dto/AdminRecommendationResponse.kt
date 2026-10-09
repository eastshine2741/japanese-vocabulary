package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminRecommendationResponse(
    val id: Long,
    val songId: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val orderIndex: Int,
    val createdAt: Instant?,
)
