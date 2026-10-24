package com.japanese.vocabulary.songanalysis.dto

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.service.SongAnalysisProgress
import java.time.Instant

data class SongAnalysisWorkDto(
    val workId: Long,
    val status: SongAnalysisWorkStatus,
    val currentStage: String?,
    val progress: Double,
    val songId: Long?,
    val lyricId: Long?,
    val youtubeUrl: String?,
    val canOpenPlayer: Boolean,
    val isAnalysisComplete: Boolean,
    val errorCode: String?,
    val errorMessage: String?,
)

/** [stageStartedAt] 은 현재 단계 행이 시작된 시각. 없으면 진행도가 단계 경계에 머문다. */
fun SongAnalysisWorkEntity.toDto(stageStartedAt: Instant? = null, now: Instant = Instant.now()): SongAnalysisWorkDto {
    val playerReady = songId != null && lyricId != null && playerReadyAt != null
    return SongAnalysisWorkDto(
        workId = requireNotNull(id),
        status = status,
        currentStage = currentStage?.name,
        progress = SongAnalysisProgress.of(status, currentStage, stageStartedAt, now),
        songId = songId,
        lyricId = lyricId,
        youtubeUrl = youtubeUrl,
        canOpenPlayer = playerReady,
        isAnalysisComplete = status == SongAnalysisWorkStatus.COMPLETED,
        errorCode = errorCode,
        errorMessage = errorMessage,
    )
}
