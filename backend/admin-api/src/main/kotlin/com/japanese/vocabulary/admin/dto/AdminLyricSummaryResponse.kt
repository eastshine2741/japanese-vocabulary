package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminLyricSummaryResponse(
    val id: Long,
    val songId: Long,
    val lyricType: String,
    val status: String,
    val retryCount: Int,
    val lrclibId: Long?,
    val vocadbId: Long?,
    val createdAt: Instant?,
    val updatedAt: Instant?,
)
