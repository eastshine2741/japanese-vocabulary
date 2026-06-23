package com.japanese.vocabulary.song.dto

import com.japanese.vocabulary.song.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.song.entity.SongAnalysisWorkStatus

data class SongAnalysisWorkDto(
    val workId: Long,
    val status: SongAnalysisWorkStatus,
    val currentStage: String?,
    val songId: Long?,
    val canOpenPlayer: Boolean,
    val isAnalysisComplete: Boolean,
    val errorCode: String?,
    val errorMessage: String?,
)

fun SongAnalysisWorkEntity.toDto(): SongAnalysisWorkDto {
    val playerReady = songId != null && lyricId != null && playerReadyAt != null
    return SongAnalysisWorkDto(
        workId = requireNotNull(id),
        status = status,
        currentStage = currentStage?.name,
        songId = songId,
        canOpenPlayer = playerReady,
        isAnalysisComplete = status == SongAnalysisWorkStatus.COMPLETED,
        errorCode = errorCode,
        errorMessage = errorMessage,
    )
}
