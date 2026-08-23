package com.japanese.vocabulary.recommendation.dto

import java.time.LocalDate

data class SongRecommendationResponse(
    val id: Long,
    val songId: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val weekStartDate: LocalDate,
)
