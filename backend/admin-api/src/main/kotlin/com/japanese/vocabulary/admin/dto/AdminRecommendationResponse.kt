package com.japanese.vocabulary.admin.dto

import java.time.Instant
import java.time.LocalDate

data class AdminRecommendationResponse(
    val id: Long,
    val candidateId: Long,
    val weekStartDate: LocalDate,
    val status: String,
    val songId: Long,
    val lyricId: Long,
    val orderIndex: Int,
    val publishedAt: Instant?,
    val createdAt: Instant?,
    val updatedAt: Instant?,
)
