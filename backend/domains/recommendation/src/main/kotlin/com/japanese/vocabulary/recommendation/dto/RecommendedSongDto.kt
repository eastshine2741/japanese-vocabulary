package com.japanese.vocabulary.recommendation.dto

import java.time.Instant

data class RecommendedSongDto(
    val id: Long,
    val songId: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val orderIndex: Int,
    val createdAt: Instant?,
)
