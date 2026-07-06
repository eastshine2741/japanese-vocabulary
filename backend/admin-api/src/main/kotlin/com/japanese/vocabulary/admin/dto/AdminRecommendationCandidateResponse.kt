package com.japanese.vocabulary.admin.dto

import java.time.Instant
import java.time.LocalDate

data class AdminRecommendationCandidateResponse(
    val id: Long,
    val source: String,
    val sourceSongId: String,
    val weekStartDate: LocalDate,
    val sourceRank: Int,
    val status: String,
    val title: String,
    val artistName: String,
    val artworkUrl: String?,
    val sourceUrl: String?,
    val releaseDate: LocalDate?,
    val songAnalysisWorkId: Long?,
    val songId: Long?,
    val lyricId: Long?,
    val createdAt: Instant?,
    val updatedAt: Instant?,
)
