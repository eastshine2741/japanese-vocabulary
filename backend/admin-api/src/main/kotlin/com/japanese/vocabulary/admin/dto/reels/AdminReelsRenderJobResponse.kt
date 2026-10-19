package com.japanese.vocabulary.admin.dto.reels

import java.time.Instant

data class AdminReelsRenderJobResponse(
    val id: String,
    val songId: Long,
    val title: String,
    val artist: String,
    val status: AdminReelsRenderJobStatus,
    /** FAILED 일 때만. `render_failed` 또는 `render_timeout`. */
    val error: String?,
    val createdAt: Instant,
    val finishedAt: Instant?,
)

enum class AdminReelsRenderJobStatus { QUEUED, RUNNING, SUCCEEDED, FAILED }
