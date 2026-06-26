package com.japanese.vocabulary.admin.dto.reels

data class AdminReelsSongDetailResponse(
    val song: AdminReelsSongCandidateResponse,
    val headline: String,
    val instagramHandle: String,
    val catchphrase: String,
    val minLineCount: Int,
    val maxLineCount: Int?,
    val lines: List<AdminReelsLyricLineResponse>,
)
