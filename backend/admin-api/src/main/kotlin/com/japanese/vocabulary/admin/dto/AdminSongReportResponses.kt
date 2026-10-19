package com.japanese.vocabulary.admin.dto

import com.japanese.vocabulary.song.model.SongEditOp
import com.japanese.vocabulary.song.model.SongReportChange
import com.japanese.vocabulary.song.model.SongReportTarget
import com.japanese.vocabulary.song.model.Token
import java.time.Instant

data class AdminSongReportSummaryResponse(
    val id: Long,
    val songId: Long,
    val songTitle: String?,
    val songArtist: String?,
    val userId: Long,
    val username: String?,
    val type: String,
    val typeLabel: String,
    val status: String,
    val createdAt: Instant?,
    val reviewedAt: Instant?,
)

data class AdminSongReportDetailResponse(
    val id: Long,
    val songId: Long,
    val songTitle: String?,
    val songArtist: String?,
    val userId: Long,
    val username: String?,
    val type: String,
    val typeLabel: String,
    val status: String,
    val createdAt: Instant?,
    val reviewedAt: Instant?,
    val target: SongReportTarget?,
    val suggestion: String?,
    val reviewChanges: List<SongReportChange>?,
    val reviewNote: String?,
    val context: AdminSongReportContextResponse,
)

data class AdminSongReportContextResponse(
    val song: AdminSongReportSongResponse?,
    val reportLyricId: Long?,
    val activeLyricId: Long?,
    /** 제보가 가리킨 줄의 현재 active 가사 내용. 제보 시점 내용은 남기지 않는다. */
    val line: AdminSongReportLineResponse?,
)

data class AdminSongReportSongResponse(
    val id: Long,
    val title: String,
    val artist: String,
    val youtubeUrl: String?,
)

data class AdminSongReportLineResponse(
    val index: Int,
    val text: String,
    val koreanLyrics: String?,
    val tokens: List<Token>,
)

data class AdminSongReportApproveRequest(
    val changes: List<SongEditOp> = emptyList(),
    val note: String? = null,
)

data class AdminSongReportRejectRequest(
    val note: String? = null,
)
