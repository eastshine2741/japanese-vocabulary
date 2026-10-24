package com.japanese.vocabulary.song.dto

data class SongAnalysisWorkResponse(
    val workId: Long,
    val status: String,
    val currentStage: String?,
    /** 0..1. 서버가 단계와 경과 시간으로 계산한다. 앱은 단계를 해석하지 않는다. */
    val progress: Double,
    val songId: Long?,
    val lyricId: Long?,
    val youtubeUrl: String?,
    val canOpenPlayer: Boolean,
    val isAnalysisComplete: Boolean,
    val errorCode: String?,
    val errorMessage: String?,
)
