package com.japanese.vocabulary.admin.dto

import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import java.time.Instant

data class AdminLyricDetailResponse(
    val id: Long,
    val songId: Long,
    val lyricType: String,
    val rawContent: List<LyricLineData>,
    val analyzedContent: List<AnalyzedLine>?,
    val status: String,
    val retryCount: Int,
    val lrclibId: Long?,
    val vocadbId: Long?,
    val createdAt: Instant?,
    val updatedAt: Instant?,
)
