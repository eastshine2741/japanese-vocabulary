package com.japanese.vocabulary.admin.dto

import java.time.Instant

/** 단계 하나. 산출물은 크기만 싣고, 내용은 단계별 output 엔드포인트로 따로 받는다. */
data class AdminSongAnalysisStageResponse(
    val stage: String,
    val status: String,
    val attempt: Int,
    val errorCode: String?,
    val errorClass: String?,
    val errorMessage: String?,
    val outputLength: Int?,
    val startedAt: Instant?,
    val finishedAt: Instant?,
)
