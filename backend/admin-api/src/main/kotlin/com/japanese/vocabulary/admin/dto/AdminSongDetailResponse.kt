package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminSongDetailResponse(
    val id: Long,
    val title: String,
    val artist: String,
    val durationSeconds: Int?,
    val youtubeUrl: String?,
    val artworkUrl: String?,
    val createdAt: Instant?,
    val updatedAt: Instant?,
    val lyric: AdminLyricSummaryResponse?,
    val activeReanalysisWork: AdminSongAnalysisWorkSummaryResponse?,
    val analysisWorks: List<AdminSongAnalysisWorkSummaryResponse>,
)
