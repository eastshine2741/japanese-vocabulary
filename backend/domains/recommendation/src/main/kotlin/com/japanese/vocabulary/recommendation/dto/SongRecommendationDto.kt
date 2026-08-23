package com.japanese.vocabulary.recommendation.dto

import com.japanese.vocabulary.recommendation.entity.SongRecommendationEntity
import com.japanese.vocabulary.recommendation.entity.SongRecommendationStatus
import java.time.Instant
import java.time.LocalDate

data class SongRecommendationDto(
    val id: Long,
    val candidateId: Long,
    val weekStartDate: LocalDate,
    val status: SongRecommendationStatus,
    val songId: Long,
    val lyricId: Long,
    val orderIndex: Int,
    val publishedAt: Instant?,
    val createdAt: Instant?,
    val updatedAt: Instant?,
)

fun SongRecommendationEntity.toDto(): SongRecommendationDto = SongRecommendationDto(
    id = requireNotNull(id),
    candidateId = candidateId,
    weekStartDate = weekStartDate,
    status = status,
    songId = songId,
    lyricId = lyricId,
    orderIndex = orderIndex,
    publishedAt = publishedAt,
    createdAt = createdAt,
    updatedAt = updatedAt,
)
