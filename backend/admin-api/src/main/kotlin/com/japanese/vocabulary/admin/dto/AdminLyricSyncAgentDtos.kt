package com.japanese.vocabulary.admin.dto

import com.japanese.vocabulary.song.entity.LyricMvSyncMethod
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.LyricLineTiming

data class AdminLyricSyncClaimResponse(
    val id: Long,
    val attempt: Int,
    val songId: Long,
    val title: String,
    val artist: String,
    val durationSeconds: Int?,
    val lyricId: Long,
    val lyricType: String,
    val youtubeVideoId: String,
    val lines: List<LyricLineData>,
)

data class AdminLyricSyncCompleteRequest(
    val attempt: Int,
    val method: LyricMvSyncMethod,
    val lines: List<LyricLineTiming>,
    val confidence: Map<String, Any?>? = null,
)

data class AdminLyricSyncFailRequest(
    val attempt: Int,
    val message: String,
    /** 실행기 쪽 사정(다운로드 차단, GPU 오류)이면 true. 곡 자체 문제(가사를 못 찾음)면 false. */
    val retryable: Boolean = false,
)
