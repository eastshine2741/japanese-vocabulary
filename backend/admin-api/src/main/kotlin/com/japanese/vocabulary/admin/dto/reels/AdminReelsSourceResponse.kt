package com.japanese.vocabulary.admin.dto.reels

data class AdminReelsSourceResponse(
    /** admin API base 기준 MV 스트림 상대 경로. 미디어 토큰이 query 에 들어 있다. */
    val mvPath: String,
)
