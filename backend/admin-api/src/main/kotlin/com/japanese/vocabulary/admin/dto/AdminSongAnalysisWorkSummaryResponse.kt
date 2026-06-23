package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminSongAnalysisWorkSummaryResponse(
    val id: Long,
    val rawTitle: String,
    val rawArtist: String,
    val status: String,
    val currentStage: String?,
    val songId: Long?,
    val lyricId: Long?,
    val triggerSource: String,
    val createdByUserId: Long?,
    val createdAt: Instant?,
    val updatedAt: Instant?,
    val playerReadyAt: Instant?,
    val completedAt: Instant?,
    val failedAt: Instant?,
)
