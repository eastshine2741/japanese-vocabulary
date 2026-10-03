package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminSongAnalysisWorkDetailResponse(
    val id: Long,
    val rawTitle: String,
    val rawArtist: String,
    val durationSeconds: Int?,
    val artworkUrl: String?,
    val status: String,
    val currentStage: String?,
    val songId: Long?,
    val lyricId: Long?,
    val youtubeUrl: String?,
    val errorCode: String?,
    val errorMessage: String?,
    val triggerSource: String,
    val createdByUserId: Long?,
    val createdAt: Instant?,
    val updatedAt: Instant?,
    val playerReadyAt: Instant?,
    val completedAt: Instant?,
    val failedAt: Instant?,
    /** 이번 실행이 시작된 시각. 실패한 단계부터 다시 돌리면 새로 찍힌다. */
    val startedAt: Instant?,
    val stages: List<AdminSongAnalysisStageResponse>,
    /** 실패한 단계부터 다시 돌릴 수 있는지. 단계 원장이 생기기 전에 실패한 작업은 못 한다. */
    val resumable: Boolean,
)
