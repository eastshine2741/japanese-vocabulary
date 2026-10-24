package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminLyricMvSyncSummaryResponse(
    val id: Long,
    val songId: Long?,
    val title: String?,
    val artist: String?,
    val lyricId: Long,
    val lyricType: String?,
    val youtubeVideoId: String,
    val status: String,
    val method: String?,
    val attempt: Int,
    val verdict: String?,
    val lineCount: Int?,
    val anchoredCount: Int?,
    val errorMessage: String?,
    val completedAt: Instant?,
    /** 앱이 이 결과를 쓰는지. 곡의 지금 active 가사·MV 조합의 COMPLETED 이고 LOW 가 아니어야 한다. */
    val inUse: Boolean,
)

data class AdminLyricMvSyncDetailResponse(
    val summary: AdminLyricMvSyncSummaryResponse,
    val confidence: Map<String, Any?>?,
    val lines: List<AdminLyricMvSyncLineResponse>,
)

data class AdminLyricMvSyncLineResponse(
    val index: Int,
    val text: String,
    val originalStartTimeMs: Long?,
    val syncedStartTimeMs: Long?,
)
