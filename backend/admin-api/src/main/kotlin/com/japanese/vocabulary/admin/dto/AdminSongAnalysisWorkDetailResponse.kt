package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminSongAnalysisWorkDetailResponse(
    val id: Long,
    val rawTitle: String,
    val rawArtist: String,
    val durationSeconds: Int?,
    val artworkUrl: String?,
    val activeDedupKey: String?,
    val status: String,
    val currentStage: String?,
    val songId: Long?,
    val lyricId: Long?,
    val lockedBy: String?,
    val lockedUntil: Instant?,
    val errorCode: String?,
    val errorMessage: String?,
    val triggerSource: String,
    val createdByUserId: Long?,
    val createdAt: Instant?,
    val updatedAt: Instant?,
    val playerReadyAt: Instant?,
    val completedAt: Instant?,
    val failedAt: Instant?,
)
