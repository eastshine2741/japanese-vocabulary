package com.japanese.vocabulary.recommendation.dto

data class SongRecommendationResponse(
    val id: Long,
    val songId: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
)
