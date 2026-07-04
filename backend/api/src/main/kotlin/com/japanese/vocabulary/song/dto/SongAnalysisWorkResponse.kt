package com.japanese.vocabulary.song.dto

data class SongAnalysisWorkResponse(
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
