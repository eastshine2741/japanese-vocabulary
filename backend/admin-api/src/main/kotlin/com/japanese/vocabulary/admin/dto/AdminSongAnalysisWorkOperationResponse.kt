package com.japanese.vocabulary.admin.dto

data class AdminSongAnalysisWorkOperationResponse(
    val workId: Long,
    val status: String,
    val currentStage: String?,
    val songId: Long?,
    val lyricId: Long?,
    val youtubeUrl: String?,
    val canOpenPlayer: Boolean,
    val isAnalysisComplete: Boolean,
    val errorCode: String?,
    val errorMessage: String?,
)
